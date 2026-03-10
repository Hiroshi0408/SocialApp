import { useState, useRef } from "react";

function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const inputRefs = useRef({});

  Object.keys(initialValues).forEach((key) => {
    if (!inputRefs.current[key]) {
      inputRefs.current[key] = { current: null };
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = (onSubmit) => (e) => {
    e.preventDefault();

    const validationErrors = validate(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      const firstErrorField = Object.keys(validationErrors)[0];
      const errorRef = inputRefs.current[firstErrorField];

      if (errorRef?.current) {
        errorRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        errorRef.current.focus();
      }

      return;
    }
    onSubmit(values);
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
  };

  return {
    values,
    errors,
    inputRefs: inputRefs.current,
    handleChange,
    handleSubmit,
    resetForm,
    setErrors,
  };
}

export default useForm;
