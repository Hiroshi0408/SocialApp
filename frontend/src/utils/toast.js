import toast from "react-hot-toast";

export const showSuccess = (message) => {
  toast.success(message);
};

export const showError = (message) => {
  toast.error(message);
};

export const showInfo = (message) => {
  toast(message);
};

export const showLoading = (message) => {
  return toast.loading(message);
};

export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

export const showPromise = (promise, messages) => {
  return toast.promise(promise, messages);
};
