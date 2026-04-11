# Hyperskills

A hyperskill (hypertext skill) is a URL containing a skill base64url-encoded in the `hs` query parameter. Gzip compression is enabled by default.

## Website

[hyperskills.net](https://hyperskills.net)

## NPM

```bash
npm install hyperskills
```

[npmjs.com/package/hyperskills](https://www.npmjs.com/package/hyperskills)

## Format

```
source_url?hs=gz.BASE64URL_CONTENT   (gzip, default)
source_url?hs=br.BASE64URL_CONTENT   (brotli, Node.js only)
source_url?hs=BASE64URL_CONTENT      (no compression)
```

Content is free-form: Markdown, SQL, YAML, HTML, plain text. License is up to the author.

## Size limits

| Browser | Max characters |
|---------|---------------|
| Chrome / Edge | ~32,000 |
| Firefox | ~65,000 |
| Safari | ~80,000 |

With compression (`gz.` / `br.` prefix): 250–500 KB fit in ~32,000 characters.

## See also

- [Skillpedia](https://skillpedia.eu) — CC-licensed skill directory
- [blog.hyperskills.net](https://blog.hyperskills.net) — blog
- [webmcp-auto-ui](https://github.com/jeanbaptiste/webmcp-auto-ui) — example app using hyperskills
- [Agent Skills](https://agentskills.io/)
- [MCP](https://modelcontextprotocol.io/)
- [WebMCP](https://webmachinelearning.github.io/webmcp/)

## License

CC BY-SA 4.0 — Copyright CERI SAS
