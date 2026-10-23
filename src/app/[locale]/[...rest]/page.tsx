import { notFound } from "next/navigation";

// Always a 404, so there is no static shell to validate for instant navigation.
export const instant = false;

// Unknown paths inside a locale render the localized not-found page.
export default function CatchAll() {
  notFound();
}
