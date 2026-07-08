import { SmilePlus, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  customerSatisfication,
  totalCustomers,
} from "@/data/customer-satisfication";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";

const customerSatisficationOptions = [
  {
    label: "Positive",
    colorToken: "--success",
    percentage: customerSatisfication.positive,
    icon: <ThumbsUp className="h-6 w-6 fill-success stroke-success" />,
  },
  {
    label: "Neutral",
    colorToken: "--caution",
    percentage: customerSatisfication.neutral,
    icon: <ThumbsUp className="h-6 w-6 fill-caution stroke-caution" />,
  },
  {
    label: "Negative",
    colorToken: "--danger",
    percentage: customerSatisfication.negative,
    icon: <ThumbsDown className="h-6 w-6 fill-danger stroke-danger" />,
  },
];

export default function CustomerSatisfication() {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Customer Satisfication" icon={SmilePlus} />
      <div className="my-4 flex h-full items-center justify-between">
        <div className="mx-auto grid w-full grid-cols-2 gap-6">
          <TotalCustomers />
          {customerSatisficationOptions.map((option) => (
            <LinearProgress
              key={option.label}
              label={option.label}
              colorToken={option.colorToken}
              percentage={option.percentage}
              icon={option.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TotalCustomers() {
  return (
    <div className="flex flex-col items-start justify-center">
      <div className="text-xs text-muted-foreground">Responses Received</div>
      <div className="text-2xl font-medium">{totalCustomers} Customers</div>
    </div>
  );
}
