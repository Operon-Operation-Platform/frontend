"use client";

import { OperonProvider } from "../../context/OperonContext";
import SignupForm from "../../features/auth/SignupForm";

export default function SignupPage() {
  return (
    <OperonProvider>
      <SignupForm />
    </OperonProvider>
  );
}
