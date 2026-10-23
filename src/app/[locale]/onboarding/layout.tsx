import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme";
import { Link } from "@/i18n/navigation";

export default function OnboardingLayout({ children }: LayoutProps<"/[locale]/onboarding">) {
  return (
    <div className="glow-mint min-h-dvh">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="MessMate BD">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher compact />
          <ThemeToggle />
          <SignOutButton iconOnly />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">{children}</main>
    </div>
  );
}
