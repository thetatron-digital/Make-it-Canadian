"use client";

import { useParams } from "next/navigation";
import { LiveStage } from "@/components/LiveStage";

export default function LivePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  return <LiveStage id={id} />;
}
