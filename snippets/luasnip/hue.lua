-- Hue Markdown LuaSnip Snippets
local ls = require("luasnip")
local s = ls.snippet
local t = ls.text_node
local i = ls.insert_node

return {
  s("info", {
    t("+-- info "), i(1, "Title"), t({ "", "| " }), i(2, "Content"), t({ "", "+--" })
  }),
  s("warn", {
    t("+-- warn "), i(1, "Title"), t({ "", "| " }), i(2, "Content"), t({ "", "+--" })
  }),
  s("ok", {
    t("+-- ok "), i(1, "Title"), t({ "", "| " }), i(2, "Content"), t({ "", "+--" })
  }),
  s("note", {
    t("+-- note "), i(1, "Title"), t({ "", "| " }), i(2, "Content"), t({ "", "+--" })
  }),
  s("danger", {
    t("+-- danger "), i(1, "Title"), t({ "", "| " }), i(2, "Content"), t({ "", "+--" })
  }),
  s("span", {
    t("{"), i(1, "info"), t(": "), i(2, "text"), t("}")
  }),
}
