its a modular monolith

src/
├── modules/
│   ├── auth/           # Identity & JWT logic
│   ├── users/          # Profile & User management
│   ├── chat/           # 1-to-1 & Group messages (WebSockets)
│   └── calls/          # WebRTC signaling for Audio/Video
├── shared/             # Global filters, interceptors, and decorators
├── common/             # Pure TS utilities, constants, and types
├── prisma/             # Schema and Prisma Client
└── main.ts             # Entry point



we kept users authentication and jwt inside users 

