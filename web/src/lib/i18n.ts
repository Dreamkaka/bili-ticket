import { defineTranslations } from "fumadocs-core/i18n";
import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import { zhCN } from "@fumadocs/language/zh-cn";

export const i18n = i18nProvider(
  defineTranslations().extend(uiTranslations()).preset(zhCN())
);
