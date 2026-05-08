# Frontend — SocialApp UI

React 19 (Create React App) + react-router v7 + axios + socket.io-client + ethers v6 + i18next.

> Đây là tầng UI cho SocialApp.
> README tổng quan ở [../README.md](../README.md).

---

## 1. Tổng quan

- React 19 + CRA (chưa eject — nếu eject sẽ một chiều, cân nhắc kỹ).
- Routing: react-router v7, page lazy load qua `React.lazy` + `Suspense`.
- State global: Context API (Auth, Socket, Theme, Web3) — **không** dùng Redux/Zustand.
- HTTP: 1 axios instance shared, interceptor tự gắn `Bearer token` và xử lý 401.
- Realtime: 1 socket connection toàn app, hook `useSocket()` cho component.
- Web3: ethers v6 + MetaMask, mặc định Sepolia testnet.
- i18n: vi (default) + en, mọi string user-facing phải qua `t("key")`.

---

## 2. Cấu trúc thư mục

```
frontend/
├── public/                  Static + index.html
├── src/
│   ├── App.jsx              Routes + Provider chain (Auth → Socket → Web3)
│   ├── App.css              Global theme (CSS variables cho dark mode)
│   ├── index.js             Mount React + i18n init
│   ├── constants.js         API URL, Sepolia constants, Etherscan base, …
│   │
│   ├── api/                 1 file service / domain — tất cả HTTP request đi qua đây
│   │   ├── axios.js         Instance + interceptor (token + 401 redirect)
│   │   ├── authService.js
│   │   ├── postService.js
│   │   ├── userService.js
│   │   ├── charityService.js
│   │   ├── web3Service.js
│   │   └── …
│   │
│   ├── contexts/            State global
│   │   ├── AuthContext.jsx  user, token, login/logout, refresh
│   │   ├── SocketContext.jsx Singleton Socket.io connection
│   │   ├── ThemeContext.jsx light / dark
│   │   └── Web3Context.jsx  walletAddress, balance, connect/disconnect, switchToSepolia
│   │
│   ├── pages/               Folder-per-page (.jsx + .css)
│   │   ├── Login/ Register/ VerifyEmail/ ForgotPassword/ ResetPassword/
│   │   ├── Home/ Profile/ Search/ Friends/ Notifications/ Messages/
│   │   ├── Post/ Settings/
│   │   ├── Communities/ GroupDetail/
│   │   ├── ApplyOrganization/ MyOrganization/ OrganizationDetail/
│   │   ├── Charity/ CharityDetail/ CreateCampaign/
│   │   ├── VerifyPost/      Public — verify post on-chain
│   │   └── AdminDashboard/
│   │
│   ├── components/          Folder-per-component reusable
│   │   ├── PostCard/ CommentItem/ PrivateRoute/ AdminRoute/
│   │   ├── Sidebar/ Loading/ Modal/
│   │   ├── CampaignCard/ DonateModal/ ClaimRefundModal/
│   │   ├── TxStatusModal/   Reusable cho mọi tx FE-signed
│   │   ├── MilestoneList/ VerifiedBadge/
│   │   └── …
│   │
│   ├── hooks/
│   │   ├── useForm.js       Form state + validate chung
│   │   ├── useAvatarError.js Fallback avatar
│   │   └── useVoiceCall.js  WebRTC peer-to-peer
│   │
│   ├── utils/
│   │   ├── web3Errors.js    parseWeb3Error, assertSepolia
│   │   ├── timeAgo.js
│   │   └── …
│   │
│   └── localization/
│       ├── i18n.js
│       ├── vi.json
│       └── en.json
└── package.json
```

---

## 3. Env

Copy `.env.example` → `.env` và điền:

| Env | Bắt buộc | Ghi chú |
|-----|----------|---------|
| `REACT_APP_API_URL` | **có** | Mặc định `http://localhost:5000/api` |
| `REACT_APP_SOCKET_URL` | **có** | Socket.io URL, mặc định `http://localhost:5000` |
| `REACT_APP_CLOUDINARY_CLOUD_NAME` | – | Nếu dùng upload trực tiếp client → Cloudinary |
| `REACT_APP_CLOUDINARY_UPLOAD_PRESET` | – | – |
| `REACT_APP_FIREBASE_API_KEY` | – | Cho Google login (nếu enable) |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | – | – |
| `REACT_APP_FIREBASE_PROJECT_ID` | – | – |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | – | – |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | – | – |
| `REACT_APP_FIREBASE_APP_ID` | – | – |
| `REACT_APP_CHARITY_ADDRESS` | – | Charity contract Sepolia, dùng cho FE-signed donate / claimRefund |

CRA chỉ expose env có prefix `REACT_APP_` ra browser. Đổi `.env` phải restart `npm start`.

---

## 4. Chạy

```bash
npm install
npm start            # CRA dev server, port 3000
npm run build        # production build → ./build
npm run analyze      # source-map-explorer (phải build trước)
npm test             # CRA test runner (Jest watch)
```

---

## 5. Routing

Routes định nghĩa trong [App.jsx](src/App.jsx). Convention:

- **Public:** `/`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/verify/:postId`, `/charity`, `/charity/:id`, `/communities`, `/org/:slug`.
- **Private** (wrap `<PrivateRoute>`): `/home`, `/profile`, `/search`, `/friends`, `/notifications`, `/messages`, `/post/:postId`, `/settings`, `/groups/:groupId`, `/organizations/apply`, `/organizations/mine`, `/charity/create`.
- **Admin** (wrap `<AdminRoute>`): `/admin`.
- **Legacy redirect**: `/groups` → `/communities?tab=groups`, `/organizations` → `/communities?tab=orgs`.

Mọi page **lazy import** + bọc `<Suspense fallback={<Loading />}>` ở `App.jsx`.

```jsx
const Charity = lazy(() => import("./pages/Charity/Charity"));
```

---

## 6. Provider chain

App.jsx wrap theo thứ tự (từ ngoài vào trong):

```
AuthProvider
  └── SocketProvider           (cần token từ Auth để init socket)
        └── Web3Provider       (độc lập, gắn listener accountsChanged + chainChanged)
              └── BrowserRouter
                    └── Toaster + Suspense + Routes
```

Lý do chuỗi: Socket cần JWT từ Auth, Web3 không phụ thuộc nhưng để trong cùng để
share toast theme. Đổi thứ tự sẽ vỡ socket auth.

---

## 7. State management

- **Global:** Context. Không cài Redux/Zustand.
- **Local:** `useState` / `useReducer`.
- **Server state:** chưa có react-query — fetch trong `useEffect` rồi `setState`.
  Khi viết hook fetch nhớ guard `isMounted` để tránh setState sau unmount.

```jsx
useEffect(() => {
  let mounted = true;
  fetchData().then((data) => mounted && setData(data));
  return () => { mounted = false; };
}, [orgId]);
```

---

## 8. API layer

**Bắt buộc** mọi HTTP request đi qua file service trong [src/api/](src/api/).
**Không** gọi `axios` trực tiếp trong component.

```js
// src/api/postService.js
import axios from "./axios";

export const getFeed = (page) =>
  axios.get(`/posts/feed?page=${page}`).then((r) => r.data);
```

- Axios instance ở [api/axios.js](src/api/axios.js):
  - Tự gắn `Authorization: Bearer <token>` từ localStorage.
  - Tự redirect về `/` khi gặp `401` + có token (token hết hạn).
- Base URL: `process.env.REACT_APP_API_URL`, fallback `http://localhost:5000/api`.

---

## 9. Web3

Web3 hoàn toàn **optional** — app chạy bình thường khi user không có MetaMask.

- Hook: `const { walletAddress, balance, connectWallet, disconnect, switchToSepolia } = useWeb3()`.
- Network: chỉ Sepolia (`SEPOLIA_CHAIN_ID = "0xaa36a7"`).
- Auto-connect: nếu user đã connect phiên trước, `eth_accounts` (no popup) sẽ
  tự khởi động lại — không cần bấm nút.
- Listener: `accountsChanged` (đổi ví / disconnect), `chainChanged` (đổi network → toast cảnh báo).
- Error: dùng `parseWeb3Error()` từ [utils/web3Errors.js](src/utils/web3Errors.js)
  để format toast đồng nhất (4 case: rejected / insufficient / network / unknown).
- Pattern modal cho tx FE-signed: dùng `<TxStatusModal>` chung, caller (DonateModal,
  ClaimRefundModal, …) tự quản lý state, truyền vào props.

---

## 10. UI conventions

- **Folder-per-component / page**: mỗi component / page là 1 folder gồm `.jsx` + `.css`.
- **Không inline style lớn**, không CSS-in-JS (project không cài styled-components).
- **i18n:** mọi string user-facing → `t("key")`. Đừng hard-code tiếng Việt/Anh trong JSX.
- **Toast:** dùng `react-hot-toast` (theme cấu hình ở [App.jsx](src/App.jsx#L56-L72)). Import `{ toast } from "react-hot-toast"`.
- **Form:** dùng [`useForm` hook](src/hooks/useForm.js), validation chính ở BE — FE chỉ check nhẹ.
- **Theme:** CSS variable trong [App.css](src/App.css), toggle dark mode qua [ThemeContext](src/contexts/ThemeContext.jsx).
- **Image fallback:** dùng `useAvatarError()` cho avatar bị 404.

---

## 11. Anti-pattern (đừng làm)

- `import * as postService from ...` — chọn named import cho rõ ràng.
- `localStorage.setItem("token", ...)` rải rác — auth token chỉ set tại `AuthContext` và `axios.js`.
- Gọi `socket.emit(...)` trực tiếp trong component — qua `useSocket()` hook.
- Tự `axios.get(...)` ngoài `src/api/`.
- Hard-code chữ tiếng Việt trong JSX (phải qua `t()`).

Xem đầy đủ: [.claude/rules/frontend-conventions.md](../.claude/rules/frontend-conventions.md).

---

## 12. Test

```bash
npm test
```

CRA chạy Jest watch mode. Test file đặt cùng folder component (`*.test.jsx`).
Coverage UI hiện thấp — đang ưu tiên test BE + contract Solidity. Sẽ bổ sung sau.

---

## 13. Build & deploy

```bash
npm run build
```

Build ra `./build`, deploy được lên bất kỳ static host nào (Vercel, Netlify,
Nginx tĩnh, Firebase Hosting, …). Đảm bảo cấu hình rewrite SPA (mọi path không
match file → trả `index.html`) để react-router v7 hoạt động.

Phân tích bundle:

```bash
npm run analyze
```
