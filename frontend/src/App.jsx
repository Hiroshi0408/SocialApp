import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import PrivateRoute from "./components/PrivateRoute/PrivateRoute";
import AdminRoute from "./components/AdminRoute/AdminRoute";
import Loading from "./components/Loading/Loading";
import "./App.css";
import { Web3Provider } from "./contexts/Web3Context";

const Login = lazy(() => import("./pages/Login/Login"));
const Register = lazy(() => import("./pages/Register/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail/VerifyEmail"));
const ForgotPassword = lazy(
  () => import("./pages/ForgotPassword/ForgotPassword"),
);
const ResetPassword = lazy(() => import("./pages/ResetPassword/ResetPassword"));
const Home = lazy(() => import("./pages/Home/Home"));
const Profile = lazy(() => import("./pages/Profile/Profile"));
const Search = lazy(() => import("./pages/Search/Search"));
const Friends = lazy(() => import("./pages/Friends/Friends"));
const Notifications = lazy(() => import("./pages/Notifications/Notifications"));
const Messages = lazy(() => import("./pages/Messages/Messages"));
const Post = lazy(() => import("./pages/Post/Post"));
const Settings = lazy(() => import("./pages/Settings/Settings"));
const AdminDashboard = lazy(
  () => import("./pages/AdminDashboard/AdminDashboard"),
);
const Communities = lazy(() => import("./pages/Communities/Communities"));
const GroupDetail = lazy(() => import("./pages/GroupDetail/GroupDetail"));
const VerifyPost = lazy(() => import("./pages/VerifyPost/VerifyPost"));
const OrganizationDetail = lazy(
  () => import("./pages/OrganizationDetail/OrganizationDetail"),
);
const ApplyOrganization = lazy(
  () => import("./pages/ApplyOrganization/ApplyOrganization"),
);
const MyOrganization = lazy(
  () => import("./pages/MyOrganization/MyOrganization"),
);
const Charity = lazy(() => import("./pages/Charity/Charity"));
const CharityDetail = lazy(
  () => import("./pages/CharityDetail/CharityDetail"),
);
const CreateCampaign = lazy(
  () => import("./pages/CreateCampaign/CreateCampaign"),
);

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Web3Provider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                },
                success: {
                  iconTheme: {
                    primary: "var(--primary-color)",
                    secondary: "white",
                  },
                },
              }}
            />
            <div className="App">
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  <Route
                    path="/home"
                    element={
                      <PrivateRoute>
                        <Home />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <PrivateRoute>
                        <Profile />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/profile/:username"
                    element={
                      <PrivateRoute>
                        <Profile />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/search"
                    element={
                      <PrivateRoute>
                        <Search />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/friends"
                    element={
                      <PrivateRoute>
                        <Friends />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <PrivateRoute>
                        <Notifications />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <PrivateRoute>
                        <Messages />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/post/:postId"
                    element={
                      <PrivateRoute>
                        <Post />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <PrivateRoute>
                        <Settings />
                      </PrivateRoute>
                    }
                  />
                  {/* Communities — gộp Group list + Organization list, 2 tab.
                      Public route: tab Organizations xem được không cần login (giống
                      route /organizations cũ); tab Groups sẽ tự yêu cầu login bên trong. */}
                  <Route path="/communities" element={<Communities />} />
                  {/* Legacy — redirect URL cũ về Communities */}
                  <Route
                    path="/groups"
                    element={<Navigate to="/communities?tab=groups" replace />}
                  />
                  <Route
                    path="/groups/:groupId"
                    element={
                      <PrivateRoute>
                        <GroupDetail />
                      </PrivateRoute>
                    }
                  />

                  <Route
                    path="/admin"
                    element={
                      <PrivateRoute>
                        <AdminDashboard />
                      </PrivateRoute>
                    }
                  />
                  {/* Public — ai cũng verify được kể cả chưa login */}
                  <Route path="/verify/:postId" element={<VerifyPost />} />

                  {/* Organizations — browse list đã gộp vào /communities (tab orgs).
                      Detail + apply + mine vẫn giữ route riêng. */}
                  <Route
                    path="/organizations"
                    element={<Navigate to="/communities?tab=orgs" replace />}
                  />
                  <Route
                    path="/organizations/apply"
                    element={
                      <PrivateRoute>
                        <ApplyOrganization />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/organizations/mine"
                    element={
                      <PrivateRoute>
                        <MyOrganization />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/org/:slug" element={<OrganizationDetail />} />

                  {/* Charity — list + detail public; create cần login */}
                  <Route path="/charity" element={<Charity />} />
                  <Route
                    path="/charity/create"
                    element={
                      <PrivateRoute>
                        <CreateCampaign />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/charity/:id" element={<CharityDetail />} />

                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </div>
          </BrowserRouter>
        </Web3Provider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
