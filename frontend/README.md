# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## **✅ TEST NGAY BÂY GIỜ:**

### **1. Test Register:**

```
Full Name: Your Name
Username: myusername
Email: myemail@example.com
Password: password123
Confirm Password: password123

→ Click "Sign Up"
→ Đợi 1.5s (fake loading)
→ Thấy alert "Registration successful!"
→ Chuyển về Login page
```

### **2. Test Login với account có sẵn:**

```
Username: test
Password: password123

→ Click "Log In"
→ Đợi 1.5s
→ Chuyển sang /home
```

### **3. Test Login với account vừa register:**

```
Username: myusername
Password: password123

→ Login thành công!
```

### **4. Test Logout:**

```
→ Click vào avatar
→ Click "Log Out"
→ Quay về Login page
→ Thử vào /home → Redirect về Login (protected route hoạt động!)
```

---

## **📊 XEM LOGS TRONG CONSOLE:**

Mở **DevTools** (F12) → **Console tab**, bạn sẽ thấy:

```
📝 Fake Register called with: {fullName: "...", username: "..."}
✅ Fake Register success: {id: 3, username: "..."}
📊 Current fake DB: [3 users]

🔐 Fake Login called with: {username: "test", password: "password123"}
✅ Fake Login success: {id: 1, username: "test", ...}
```
