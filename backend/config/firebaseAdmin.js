const admin = require("firebase-admin");

// Lấy service account từ Firebase Console
// Project Settings > Service Accounts > Generate new private key
const serviceAccount = require("./firebase-service-account.json");

// Initialize Firebase Admin (chỉ khởi tạo 1 lần)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized successfully");
}

module.exports = admin;
