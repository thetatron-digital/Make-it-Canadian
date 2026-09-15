import type { Metadata } from "next";
import { Editor } from "@/components/Editor";

export const metadata: Metadata = {
  title: "Make an avatar — Make It Canadian",
};

export default function EditPage() {
  return <Editor />;
}
