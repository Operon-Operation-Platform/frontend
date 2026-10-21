"use client";

import { OperonProvider } from "../../context/OperonContext";
import LoginForm from "../../features/auth/LoginForm";

export default function LoginPage() {
  return (
    <OperonProvider>
      <LoginForm />
    </OperonProvider>
  );
}
