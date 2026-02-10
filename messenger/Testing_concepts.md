| Aspect                 | Monolith   | Microservices       | Monorepo         |
| ---------------------- | ---------- | ------------------- | ---------------- |
| Unit testing principle | Same       | Same                | Same             |
| Mocking                | DB, APIs   | DB + other services | DB + shared libs |
| Test location          | Inside app | Inside each service | apps/ & libs/    |
| Test scope             | Wider      | Narrower            | Clean & reusable |
| Complexity             | Low        | Medium–High         | Medium           |

| Layer       | Unit test? | Priority   |
| ----------- | ---------- | ---------- |
| Service     | ✅          | HIGH       |
| Resolver    | ✅          | MEDIUM     |
| Controller  | ✅          | MEDIUM     |
| Guard       | ✅          | HIGH       |
| Pipe        | ✅          | MEDIUM     |
| Interceptor | ✅          | LOW–MEDIUM |
| DTO         | ❌          | NONE       |
| Module      | ❌          | NONE       |
