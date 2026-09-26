import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
      <SignUp fallbackRedirectUrl="/" signInUrl="/sign-in" />
    </div>
  );
}
