# Backend — SocialApp API

Express 5 + MongoDB (Mongoose 8) + Socket.io + Cloudinary + Firebase Admin + ethers.

> Đây là tầng API + realtime + on-chain relay cho SocialApp.
> README tổng quan ở [../README.md](../README.md).

---

## 1. Kiến trúc layered

```
HTTP Request
   │
   ▼
Middlewares  (auth · validation · rateLimit · cors)
   │
   ▼
Route        (routes/*.route.js — mount validation + role)
   │
   ▼
Controller   (parse req → gọi service → res.json)
   │
   ▼
Service      (business logic, throw AppError)
   │
   ▼
DAO          (Mongoose access — find / create / update / counter)
   │
   ▼
Model        (Mongoose schema)
```

### Trách nhiệm mỗi layer

| Layer | Được làm | KHÔNG được làm |
|-------|----------|----------------|
| Controller | parse `req`, gọi service, `res.json`, `next(err)` | query Model, gọi DAO trực tiếp, import controller khác |
| Service | business rule, gọi DAO, throw `AppError` | đụng `req`/`res`, throw Mongoose error thẳng |
| DAO | `find`, `create`, `update`, counter (`$inc` qua method) | biết HTTP, biết business rule |
| Model | schema, validation, hook | — |

Quy ước counter: mọi field counter (`postsCount`, `followersCount`, `likesCount`, …)
**chỉ được mutate qua DAO method** (vd `userDAO.incrementPostsCount`).
Cấm `User.findByIdAndUpdate({ $inc: { postsCount: 1 } })` rải rác trong service/controller.

Xem chi tiết: [.claude/rules/architecture.md](../.claude/rules/architecture.md).

---

## 2. Cấu trúc thư mục

```
backend/
├── server.js                Entry — mount routes /api/*, init socket, cron
├── config/
│   ├── database.js          Mongoose connect
│   ├── socket.js            Socket.io init + auth middleware
│   ├── cloudinary.js
│   ├── firebase.js          Firebase Admin init
│   └── email.js             Nodemailer transporter
├── routes/                  Express router — tên *.route.js
│   ├── auth.route.js        Register, login, verify email, forgot/reset password
│   ├── user.route.js        Profile, follow, friend, search
│   ├── post.route.js        CRUD post + like + feed
│   ├── comment.route.js     Nested comment
│   ├── friend.route.js      Friend request → accept
│   ├── notification.route.js
│   ├── chat.route.js        Conversation + message
│   ├── group.route.js       Group + member role
│   ├── story.route.js       24h story
│   ├── save.route.js        Bookmark post
│   ├── upload.route.js      Cloudinary upload
│   ├── admin.route.js       Admin dashboard endpoints
│   ├── organization.route.js  Tổ chức (apply / verify / mine)
│   ├── charity.route.js     Charity campaign + donate
│   └── web3.route.js        Wallet auth (nonce → sign → login/link), verify post
├── controllers/             HTTP layer
├── services/                Business logic — class-based, export instance
├── dao/                     Mongoose access — bắt buộc qua đây cho counter
├── models/                  Mongoose schemas
├── middlewares/
│   ├── auth.middleware.js   JWT → gắn req.user
│   ├── role.middleware.js   isAdmin
│   ├── validation.middleware.js  express-validator chains
│   ├── errorHandler.js      Format JSON lỗi từ AppError
│   └── rateLimiter.middleware.js  apiLimiter, loginLimiter, searchLimiter, …
├── socket/
│   ├── chatHandlers.js      Send / typing / read receipt
│   └── callHandlers.js      Voice call peer-to-peer
├── jobs/
│   └── charityExpiryCron.js  Mark FAILED campaign hết hạn (mỗi 30 phút)
├── utils/
│   ├── AppError.js          Throw từ service
│   ├── logger.js            Wrap console (dùng thay console.log)
│   ├── emailService.js
│   ├── geminiModeration.js  AI moderation (fail-open)
│   ├── timeHelper.js
│   └── mentionHelper.js     Parse @mention, link tới user
├── helpers/
│   ├── generate.js          JWT token, slug, …
│   └── postHelper.js        formatPostsWithMetadata (gộp like / save / counter)
├── constants/index.js       Pagination limit, validation limit, enum
└── scripts/                 One-off scripts (migration, dry-run mode)
```

---

## 3. Env

Copy `.env.example` → `.env` và điền:

| Group | Env | Bắt buộc | Ghi chú |
|-------|-----|----------|---------|
| Server | `PORT` | – | Mặc định `5000` |
| | `NODE_ENV` | – | `development` / `production` |
| | `FRONTEND_URL` | – | CORS origin (vd `http://localhost:3000`) |
| MongoDB | `MONGODB_URI` | **có** | Local hoặc Atlas |
| JWT | `JWT_SECRET` | **có** | – |
| | `JWT_EXPIRES_IN` | – | Mặc định `7d` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME` | **có** | – |
| | `CLOUDINARY_API_KEY` | **có** | – |
| | `CLOUDINARY_API_SECRET` | **có** | – |
| Firebase | `FIREBASE_PROJECT_ID` | – | Cho Google login |
| | `FIREBASE_PRIVATE_KEY` | – | – |
| | `FIREBASE_CLIENT_EMAIL` | – | – |
| Email | `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` | – | Verify email + reset password |
| AI | `GEMINI_API_KEY` | – | Optional, fail-open |
| | `ENABLE_GEMINI_MODERATION` | – | `true`/`false` |
| | `GEMINI_FAIL_OPEN` | – | Khi Gemini lỗi vẫn cho post (mặc định `true`) |
| Web3 | `BE_WALLET_PRIVATE_KEY` | – | Ví BE để relay tx ContentRegistry. Không có = bỏ qua on-chain registration |
| | `SEPOLIA_RPC_URL` | – | RPC Sepolia (Alchemy / Infura / public) |
| | `CONTENT_REGISTRY_ADDRESS` | – | Địa chỉ contract đã deploy |
| | `CHARITY_ADDRESS` | – | Địa chỉ contract đã deploy |
| | `CHARITY_EXPIRY_CRON` | – | Cron pattern, mặc định `*/30 * * * *` |

Server **exit ngay** nếu thiếu các env có dấu **bắt buộc**
(xem [server.js:14-28](server.js#L14-L28)).

---

## 4. Chạy

```bash
npm install
npm run dev          # nodemon — port 5000
npm start            # production node server.js
npm test             # Jest + supertest
npm run test:watch
```

Health check: `GET /api/health`.

---

## 5. API tổng quan

| Mount | Route file | Domain |
|-------|------------|--------|
| `/api/auth` | [auth.route.js](routes/auth.route.js) | Register, login (email + Google + wallet), verify email, forgot / reset password |
| `/api/users` | [user.route.js](routes/user.route.js) | Profile, follow, search user |
| `/api/posts` | [post.route.js](routes/post.route.js) | CRUD post, like, feed cá nhân hoá |
| `/api/comments` | [comment.route.js](routes/comment.route.js) | Comment nested |
| `/api/friends` | [friend.route.js](routes/friend.route.js) | Friend request, accept, unfriend, block |
| `/api/notifications` | [notification.route.js](routes/notification.route.js) | List, mark read, count unread |
| `/api/chat` | [chat.route.js](routes/chat.route.js) | Conversation 1-1 + group, message |
| `/api/groups` | [group.route.js](routes/group.route.js) | Group + member role |
| `/api/stories` | [story.route.js](routes/story.route.js) | 24h story |
| `/api/saves` | [save.route.js](routes/save.route.js) | Bookmark post |
| `/api/upload` | [upload.route.js](routes/upload.route.js) | Cloudinary signed upload |
| `/api/admin` | [admin.route.js](routes/admin.route.js) | Admin dashboard (manage user / post / org / charity) |
| `/api/organizations` | [organization.route.js](routes/organization.route.js) | Apply tổ chức, list, detail, mine |
| `/api/charity` | [charity.route.js](routes/charity.route.js) | Campaign list / detail / prepare-create / record-donate / sync / refund |
| `/api/web3` | [web3.route.js](routes/web3.route.js) | Nonce, login wallet, link / unlink, verify post on-chain |

---

## 6. Response shape

**Success:**

```js
res.json({ success: true, ...payload });
res.status(201).json({ success: true, ...payload });   // POST tạo mới
```

**Lỗi:** controller `next(err)`. Service throw `AppError`:

```js
throw new AppError("User not found", 404);
throw new AppError("Validation failed", 400, { username: "Username already taken" });
```

Format JSON lỗi do [errorHandler middleware](middlewares/errorHandler.js) lo.

---

## 7. Realtime — Socket.io

- Init ở [config/socket.js](config/socket.js) — auth qua JWT trong handshake.
- Handler chia theo domain trong [socket/](socket/):
  - `chatHandlers.js` — send message, typing, read receipt
  - `callHandlers.js` — voice call signaling (offer/answer/ICE)
- Khi thêm feature realtime mới: tạo handler mới trong folder này, **không** nhét
  vào `server.js`.

---

## 8. Web3 service stack

```
controllers/web3Controller.js          ─── HTTP layer
controllers/charityController.js
   │
   ▼
services/web3Service.js                ─── wallet auth (nonce / sign / link)
services/contentRegistryService.js     ─── registerPost + verifyPost (v1/v2)
services/charityService.js             ─── createCampaign + recordDonation + sync
   │
   ▼
services/blockchainService.js          ─── ethers provider + signer base
   │
   ▼
ethers v6 → Sepolia
```

**Pattern quan trọng:**
- Mọi tx thành công cache vào Mongo (DAO riêng cho mỗi contract — `campaignDAO`, `donationDAO`).
- Counter on-chain (`raisedWei`, `unlockedTotalWei`) là String BigInt — **không tự cộng JS**, đọc từ chain rồi `syncChainCache`.
- ABI dùng Human-Readable format (string array), không import file artifact.
- ContentRegistry → **BE-relay** (BE trả gas, attribution qua `authorId` trong hash).
- Charity → **FE-signed** (contract enforce `msg.sender == beneficiary/donor`).

Chi tiết: xem section "Web3" trong [../README.md](../README.md) và [../CLAUDE.md](../CLAUDE.md).

---

## 9. Convention

- Logging: dùng [`utils/logger`](utils/logger.js), không `console.log`.
- Constants (pagination, max length, enum): tập trung tại [constants/index.js](constants/index.js).
- Validation: chain express-validator ở [middlewares/validation.middleware.js](middlewares/validation.middleware.js), mount trong route file.
- Auth: `authMiddleware` gắn `req.user = { id, username, ... }`.
- Soft delete: dùng `deleted: true, deletedAt: Date`. Không xoá vật lý.
- File upload: client gọi `POST /api/upload` lấy URL trước, mới gọi tạo post — **không** upload inline.
- Migration script ở `scripts/`: bắt buộc có dry-run mode (xem [scripts/migrateMutualFollowsToFriends.js](scripts/migrateMutualFollowsToFriends.js)).

Xem đầy đủ: [.claude/rules/backend-conventions.md](../.claude/rules/backend-conventions.md).

---

## 10. Cron job

- [jobs/charityExpiryCron.js](jobs/charityExpiryCron.js) — mỗi 30 phút (override bằng env `CHARITY_EXPIRY_CRON`):
  - Quét campaign `OPEN` đã quá hạn.
  - Gọi `Charity.markFailedIfExpired(onChainId)` → contract chuyển sang state `FAILED`.
  - Cache lại Mongo.
  - Skip nếu `CHARITY_ADDRESS` chưa set.

Demo nhanh: `CHARITY_EXPIRY_CRON="*/2 * * * *"`.

---

## 11. Test

```bash
npm test                 # Jest + supertest, chạy 1 lần
npm run test:watch       # watch mode
```

Test file ở `__tests__/` theo từng domain. Coverage chưa đầy đủ — đang ưu tiên
test contract Solidity (40+ case Charity) và integration cho flow Web3 thay vì
unit test BE thuần.
