import { AutoReload } from "@/components/app/auto-reload";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

/**
 * Also what an open tab sees after a new release. It refreshes itself once; only if the page is
 * still missing after that does the message stay.
 */
export default function NotFound() {
  return (
    <main id="main">
      <AutoReload />
      <PlaceholderPage title="Page not found">
        That page does not exist. If you had this open for a while, refresh the page or go back to
        the home screen.
      </PlaceholderPage>
    </main>
  );
}
