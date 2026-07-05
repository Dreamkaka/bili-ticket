package bilibili

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const apiURLTemplate = "https://show.bilibili.com/api/ticket/project/getV2?version=134&id=%s&project_id=%s"

type Client struct {
	httpClient *http.Client
	userAgent  string
}

func NewClient(userAgent string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 8 * time.Second},
		userAgent:  userAgent,
	}
}

type apiResponse struct {
	Errno int    `json:"errno"`
	Msg   string `json:"msg"`
	Data  struct {
		ScreenList []screen `json:"screen_list"`
	} `json:"data"`
}

type screen struct {
	Name       string   `json:"name"`
	TicketList []ticket `json:"ticket_list"`
}

type ticket struct {
	ID        int    `json:"id"`
	Desc      string `json:"desc"`
	Price     int    `json:"price"`
	SaleStart int64  `json:"saleStart"`
	SaleEnd   int64  `json:"saleEnd"`
	LessVT    int    `json:"less_vt"` // 【新增】解析 API 返回的余票字段
	SaleFlag  struct {
		Number      int    `json:"number"`
		DisplayName string `json:"display_name"`
	} `json:"sale_flag"`
}

// TicketState is the flattened, comparable representation of one ticket type.
type TicketState struct {
	Key         string // stable identity within a project: "<screen name>-<ticket id>"
	Name        string
	Status      string
	Price       int
	SaleStart   int64
	SaleEnd     int64
	ScreenName  string
	SubTicketID int
	LessVT      int // 【新增】保存解析后的余票状态
}

// 【新增】统一的 HTTP 错误类型，携带状态码供外部调用者（如 monitor）判断并上报给 Gateway
type HTTPError struct {
	StatusCode int
	ProjectID  string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("HTTP error %d (e.g. rate limit or risk control) for project %s", e.StatusCode, e.ProjectID)
}

// 【新增】业务逻辑错误类型，携带 Bilibili 的 errno 错误码（如业务级风控 -412）
type APIError struct {
	Errno     int
	Msg       string
	ProjectID string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API error %d for project %s: %s", e.Errno, e.ProjectID, e.Msg)
}

func (c *Client) Fetch(projectID string) (map[string]TicketState, error) {
	url := fmt.Sprintf(apiURLTemplate, projectID, projectID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 【修改】如果不为 200 OK，则返回携带具体状态码的 HTTPError
	if resp.StatusCode != http.StatusOK {
		return nil, &HTTPError{StatusCode: resp.StatusCode, ProjectID: projectID}
	}

	var parsed apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	// 【修改】如果接口返回的业务错误码不为 0，则返回携带具体业务错误码的 APIError
	if parsed.Errno != 0 {
		return nil, &APIError{Errno: parsed.Errno, Msg: parsed.Msg, ProjectID: projectID}
	}

	states := make(map[string]TicketState)
	for _, s := range parsed.Data.ScreenList {
		for _, t := range s.TicketList {
			key := fmt.Sprintf("%s-%d", s.Name, t.ID)
			states[key] = TicketState{
				Key:         key,
				Name:        fmt.Sprintf("%s / %s", s.Name, t.Desc),
				Status:      t.SaleFlag.DisplayName,
				Price:       t.Price,
				SaleStart:   t.SaleStart,
				SaleEnd:     t.SaleEnd,
				ScreenName:  s.Name,
				SubTicketID: t.ID,
				LessVT:      t.LessVT, // 【新增】将余票赋值给导出的 TicketState
			}
		}
	}
	return states, nil
}
