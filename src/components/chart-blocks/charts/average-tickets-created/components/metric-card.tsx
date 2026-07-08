import { chartTitle } from "@/components/primitives";
import { toneDot, type SdkTone } from "@/lib/openai-style";
import { addThousandsSeparator, cn } from "@/lib/utils";

export default function MetricCard({
  title,
  value,
  tone,
  className,
}: {
  title: string;
  value: number;
  tone: SdkTone;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <div className="mb-1 flex items-center gap-2">
        <div className={cn("h-3 w-3 rounded-sm", toneDot(tone))} />
        <h2 className={chartTitle({ color: "mute", size: "sm" })}>{title}</h2>
      </div>
      <div className="pl-4 text-xl font-medium">
        {addThousandsSeparator(value)}
      </div>
    </section>
  );
}
