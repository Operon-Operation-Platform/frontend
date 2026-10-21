"use client";

import { OperonProvider } from "../../../context/OperonContext";
import SignupForm from "../../../features/auth/SignupForm";

export default function AdminSignupRoute() {
  return (
    <OperonProvider>
      <SignupForm />
    </OperonProvider>
  );
}
