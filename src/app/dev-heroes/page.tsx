import { HeroVariant2 } from "@/components/marketing/HeroVariant2";
import { HeroVariant3 } from "@/components/marketing/HeroVariant3";

/** Scratch page for eyeballing the two hero variants. Delete before launch. */
export default function DevHeroes() {
  return (
    <main>
      <HeroVariant2 signedIn={false} />
      <div className="h-24 bg-blush" />
      <HeroVariant3 signedIn={false} />
    </main>
  );
}
