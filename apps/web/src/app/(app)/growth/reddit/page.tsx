import { redirect } from "next/navigation";

// Reddit Scout is now Community Scout — supports Reddit, HN, and Indie Hackers.
export default function RedditPage() {
  redirect("/growth/community");
}
