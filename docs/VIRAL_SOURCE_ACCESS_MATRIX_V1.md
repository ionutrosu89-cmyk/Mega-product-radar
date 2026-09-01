# Viral source access matrix V1

| Source | Supported route | Current activation | Blocker |
|---|---|---|---|
| YouTube | YouTube Data API `search.list` + `videos.list` | disabled | API key and explicit terms approval |
| TikTok | Commercial Content API | disabled | approved client key/secret and access token |
| Google Trends | reviewed export/manual evidence only | disabled | automated access method not approved |
| Meta | Ad Library API | disabled | general commercial-product coverage not established |
| Amazon | existing MPR public evidence pipeline | separate | historical confirmation and source health |
| Pinterest | no collector approved | disabled | access review |
| Reddit | official API only | disabled | app credentials and access review |

YouTube is the first implementation because it exposes a documented search API and measurable video statistics. The runner defaults to `DRY_RUN`, caps the pilot at 20 query-market pairs and performs no call unless the API key, source-enable flag and explicit terms-approval flag are all present.

TikTok Research API is not used for this commercial project. TikTok Commercial Content API remains the intended official route, subject to application approval.
