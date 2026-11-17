if vim.g.loaded_hue_md then
  return
end
vim.g.loaded_hue_md = 1

require('hue-md').setup()
