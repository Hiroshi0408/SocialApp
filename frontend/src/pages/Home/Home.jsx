import React from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import EmailVerificationBanner from "../../components/EmailVerificationBanner/EmailVerificationBanner";
import Stories from "../../components/Stories/Stories";
import Feed from "../../components/Feed/Feed";
import Suggestions from "../../components/Suggestions/Suggestions";
import "./Home.css";

function Home() {
  return (
    <div className="home-page">
      <Sidebar />
      <div className="home-content-wrapper">
        <Header />
        <EmailVerificationBanner />
        <main className="home-main">
          <div className="home-container">
            <div className="home-content">
              <Stories />
              <Feed />
            </div>
            <aside className="home-sidebar">
              <Suggestions />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Home;
