// "use client";

// import type { ReactNode } from "react";
// import { useEffect, useState } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { RefreshCw, Trophy, Users } from "lucide-react";

// type LeaderboardEntry = {
//   userId: string;
//   name: string;
//   email: string;
//   totalInvested: number;
//   progress: number;
//   eligible: boolean;
// };

// type ApiResponse = {
//   month: string;
//   range: { start: string; end: string };
//   target: number;
//   participants: number;
//   achievers: number;
//   totalInvested: number;
//   leaderboard: LeaderboardEntry[];
// };

// const formatBRL = (value: number) =>
//   value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// const NOVEMBER = "11";
// const BLACK_NOVEMBER_YEAR = 2025;

// export default function AdminBlackNovember() {
//   const [loading, setLoading] = useState(true);
//   const [data, setData] = useState<ApiResponse | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [refreshKey, setRefreshKey] = useState(0);

//   useEffect(() => {
//     let active = true;
//     const controller = new AbortController();
//     async function fetchData() {
//       try {
//         setLoading(true);
//         setError(null);
//         const monthParam = `${BLACK_NOVEMBER_YEAR}-${NOVEMBER}`;
//         const res = await fetch(`/api/admin/black-november?month=${monthParam}`, {
//           cache: "no-store",
//           signal: controller.signal,
//         });
//         if (!active) return;
//         if (!res.ok) {
//           setData(null);
//           setError("Não foi possível carregar os dados.");
//           return;
//         }
//         const json = (await res.json()) as ApiResponse;
//         setData(json);
//       } catch (err) {
//         if (!active || (err as Error).name === "AbortError") return;
//         setError("Não foi possível carregar os dados.");
//         setData(null);
//       } finally {
//         if (active) setLoading(false);
//       }
//     }
//     fetchData();
//     return () => {
//       active = false;
//       controller.abort();
//     };
//   }, [refreshKey]);

//   const handleRefresh = () => setRefreshKey((key) => key + 1);

//   const leaderboard = data?.leaderboard ?? [];

//   return (
//     <div className="space-y-6">
//       <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
//         <div>
//           <h2 className="text-2xl font-semibold">Black November Alpha</h2>
//         </div>
//         <div className="flex flex-wrap items-center gap-3">
//           <Button
//             type="button"
//             variant="outline"
//             size="sm"
//             onClick={handleRefresh}
//             className="gap-1"
//             disabled={loading}
//           >
//             <RefreshCw className="size-4" />
//             Atualizar
//           </Button>
//         </div>
//       </div>

//       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
//         <StatCard
//           title="Meta por cliente"
//           value={formatBRL(data?.target ?? 10_000)}
//           description="Investimento mínimo para recompensas"
//         />
//         <StatCard
//           title="Investimento acumulado"
//           value={formatBRL(data?.totalInvested ?? 0)}
//           description={data ? `Período: ${data.month}` : "Carregando..."}
//         />
//         <StatCard
//           title="Participantes"
//           value={data?.participants ?? 0}
//           description="Usuários com investimento"
//           icon={<Users className="size-4 text-muted-foreground" />}
//         />
//         <StatCard
//           title="Elegíveis"
//           value={data?.achievers ?? 0}
//           description="Clientes que já atingiram a meta"
//           icon={<Trophy className="size-4 text-amber-500" />}
//         />
//       </div>

//       <Card>
//         <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
//           <div>
//             <CardTitle>Progresso dos usuários</CardTitle>
//           </div>
//         </CardHeader>
//         <CardContent>
//           {loading ? (
//             <div className="space-y-4">
//               {Array.from({ length: 4 }).map((_, idx) => (
//                 <div key={idx} className="space-y-2 rounded-lg border p-4">
//                   <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
//                     <div className="h-4 w-32 animate-pulse rounded bg-muted" />
//                     <div className="h-4 w-20 animate-pulse rounded bg-muted" />
//                   </div>
//                   <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
//                 </div>
//               ))}
//             </div>
//           ) : leaderboard.length === 0 ? (
//             <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
//               Nenhum investimento registrado para novembro.
//             </div>
//           ) : (
//             <div className="space-y-4">
//               {leaderboard.map((entry) => (
//                 <div
//                   key={entry.userId}
//                   className="rounded-lg border p-4 transition hover:border-foreground/20"
//                 >
//                   <div className="flex flex-wrap items-center justify-between gap-3">
//                     <div>
//                       <p className="font-medium text-foreground">{entry.name}</p>
//                       <p className="text-sm text-muted-foreground">{entry.email}</p>
//                     </div>
//                     <div className="text-right">
//                       <p className="font-semibold text-foreground">
//                         {formatBRL(entry.totalInvested)}
//                       </p>
//                       <p className="text-xs text-muted-foreground">
//                         {entry.eligible ? "Elegível" : "Em progresso"}
//                       </p>
//                     </div>
//                   </div>
//                   <div className="mt-3 h-2 rounded-full bg-muted">
//                     <div
//                       className={`h-full rounded-full ${entry.eligible ? "bg-emerald-500" : "bg-amber-400"
//                         }`}
//                       style={{ width: `${entry.progress}%` }}
//                     />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//           {error && (
//             <p className="mt-4 text-sm text-destructive">
//               {error} Tente novamente mais tarde.
//             </p>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

// type StatCardProps = {
//   title: string;
//   value: string | number;
//   description: string;
//   icon?: ReactNode;
// };

// function StatCard({ title, value, description, icon }: StatCardProps) {
//   return (
//     <Card>
//       <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
//         <CardTitle className="text-sm font-medium text-muted-foreground">
//           {title}
//         </CardTitle>
//         {icon}
//       </CardHeader>
//       <CardContent>
//         <div className="text-2xl font-semibold">{value}</div>
//         <p className="text-sm text-muted-foreground">{description}</p>
//       </CardContent>
//     </Card>
//   );
// }
