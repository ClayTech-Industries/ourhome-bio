import { readFileSync } from "fs";
import { join } from "path";

export default function HomePage() {
  const htmlPath = join(process.cwd(), "public", "index.html");
  const html = readFileSync(htmlPath, "utf-8");

  return (
    <div
      style={{ width: "100%", minHeight: "100vh" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
