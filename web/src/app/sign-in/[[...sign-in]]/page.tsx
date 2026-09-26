import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
      <SignIn fallbackRedirectUrl="/" signUpUrl="/sign-up" />
    </div>
  );
}
