import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatsCards({ 
    title, 
    icon, 
    contentTitle, 
    contentDescription 
}: { 
    title: string, 
    icon: React.ReactNode, 
    contentTitle: string, 
    contentDescription: string 
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium hidden md:block">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{contentTitle}</div>
                <p className="text-xs text-muted-foreground">{contentDescription}</p>
            </CardContent>
        </Card>
    )
}