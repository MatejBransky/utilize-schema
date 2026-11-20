-- Starts the TypeScript 7.1 native language server for this demo.
-- Run it after opening a TypeScript file, or copy the autocmd into your config.
-- The server is `tsc --lsp`, not `ts_ls` or `vtsls`.
local root = vim.fs.root(0, { 'tsconfig.json' })

if root and root:match('content%-mapper') then
  vim.lsp.start({
    name = 'tsc-content-mapper',
    cmd = { root .. '/node_modules/.bin/tsc', '--lsp', '--stdio' },
    root_dir = root,
    -- `--runExternalCode` is not an LSP flag in TypeScript 7.1 beta;
    -- the language server reads it from initialization options.
    init_options = { runExternalCode = true },
  })
end
