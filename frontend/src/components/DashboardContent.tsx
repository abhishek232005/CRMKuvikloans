import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { dashboardRequestEnabled, permittedDashboardQuickActions, type DashboardPreset } from './dashboard-ui';

type Preset = DashboardPreset;
type Breakdown = { label: string; count: number };
type DashboardData = {
  range: { preset: Preset; from: string; to: string };
  kpis: { customers: number; leads: number; applications: number; sanctionedApplications: number; activeLeads: number; applicationsInProgress: number; rejectedApplications: number; pendingQueries: number };
  leadOverview: { byStatus: Breakdown[]; bySource: Breakdown[] };
  applicationOverview: { byStatus: Breakdown[] };
  products: Breakdown[];
  lenders: { name: string; applications: number; approved: number }[];
  documents: { total: number; byStatus: Breakdown[] };
  operations: { queries: { total: number; byStatus: Breakdown[] }; credit: { total: number; byStatus: Breakdown[] }; sanctions: { total: number; accepted: number; pendingAcceptance: number } };
  funnel: Breakdown[];
  activity: { available: boolean; items: { id: string; module: string; action: string; entityType: string; createdAt: string }[] };
};

const presetLabels: Record<Preset, string> = {
  today: 'Today',
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
  this_month: 'This Month',
  custom: 'Custom Range',
};

const number = new Intl.NumberFormat('en-IN');

function title(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function Card({ title: heading, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}><h2 className="text-base font-semibold text-slate-900">{heading}</h2>{children}</section>;
}

function KpiCard({ label, value, description, mark, tone }: { label: string; value: number; description: string; mark: string; tone: string }) {
  return <section className="min-h-36 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{number.format(value)}</p><p className="mt-2 text-xs text-slate-500">{description}</p></div><span aria-hidden="true" className={`grid h-10 w-10 place-items-center rounded-lg text-sm font-bold ${tone}`}>{mark}</span></div></section>;
}

function BarList({ rows, empty }: { rows: Breakdown[]; empty: string }) {
  const maximum = Math.max(...rows.map(row => row.count), 0);
  if (!rows.length) return <p className="mt-4 text-sm text-slate-500">{empty}</p>;
  return <ul className="mt-4 space-y-3">{rows.map(row => <li key={row.label}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-slate-700" title={title(row.label)}>{title(row.label)}</span><span className="font-semibold text-slate-900">{number.format(row.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${maximum ? (row.count / maximum) * 100 : 0}%` }} /></div></li>)}</ul>;
}

function DashboardSkeleton() {
  return <div aria-label="Loading dashboard" className="animate-pulse space-y-6"><div className="h-16 w-80 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-36 rounded-xl bg-slate-200" />)}</div><div className="grid gap-5 xl:grid-cols-2"><div className="h-72 rounded-xl bg-slate-200" /><div className="h-72 rounded-xl bg-slate-200" /></div></div>;
}

export function DashboardContent() {
  const { can } = useAuth();
  const [preset, setPreset] = useState<Preset>('last_30_days');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canViewReports = can('reports.view');
  const params = useMemo(() => ({ preset, ...(preset === 'custom' ? { from, to } : {}) }), [preset, from, to]);
  const overview = useQuery<DashboardData>({
    queryKey: ['dashboard-overview', params],
    queryFn: async () => (await api.get('/dashboard/overview', { params })).data.data,
    enabled: canViewReports && dashboardRequestEnabled(preset, from, to),
    retry: false,
  });

  if (!canViewReports) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-bold text-slate-900">Dashboard access is unavailable</h1><p className="mt-2 text-sm text-slate-700">Your role does not include permission to view reporting analytics.</p></section>;
  if (overview.isLoading) return <DashboardSkeleton />;
  if (overview.isError) return <section className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-bold text-slate-900">Unable to load dashboard data.</h1><button type="button" onClick={() => void overview.refetch()} className="mt-4 rounded bg-brand px-4 py-2 text-sm font-semibold text-white">Retry</button></section>;

  const data = overview.data;
  if (!data) return null;
  const quickActions = permittedDashboardQuickActions(can);
  const documentRows = data.documents.byStatus;

  return <div className="mx-auto max-w-screen-2xl space-y-6">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><p className="text-sm font-semibold uppercase tracking-widest text-brand">Dashboard</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Loan distribution overview</h1><p className="mt-2 text-slate-600">Operational performance across your CRM workspace.</p></div><div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><label className="text-sm font-medium text-slate-700">Date range<select aria-label="Dashboard date range" value={preset} onChange={event => setPreset(event.target.value as Preset)} className="ml-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm"><option value="today">Today</option><option value="last_7_days">Last 7 Days</option><option value="last_30_days">Last 30 Days</option><option value="this_month">This Month</option><option value="custom">Custom Range</option></select></label>{preset === 'custom' && <><label className="text-xs text-slate-600">From<input aria-label="Dashboard start date" type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-2 text-sm" /></label><label className="text-xs text-slate-600">To<input aria-label="Dashboard end date" type="date" value={to} onChange={event => setTo(event.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-2 text-sm" /></label></>}<button type="button" onClick={() => void overview.refetch()} className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Refresh</button></div></header>

    {preset === 'custom' && !(from && to) && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">Choose both dates to load the custom reporting range.</p>}
    <p className="text-sm text-slate-500">Reporting period: {data.range.from} to {data.range.to}</p>

    {quickActions.length > 0 && <Card title="Quick Actions"><div className="mt-4 flex flex-wrap gap-3">{quickActions.map(action => <Link key={action.to} to={action.to} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-900">+ {action.label}</Link>)}</div></Card>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total Customers" value={data.kpis.customers} description="Current CRM customer base" mark="C" tone="bg-cyan-50 text-cyan-700" />
      <KpiCard label="Total Leads" value={data.kpis.leads} description="Created in reporting period" mark="L" tone="bg-blue-50 text-blue-700" />
      <KpiCard label="Total Applications" value={data.kpis.applications} description="Created in reporting period" mark="A" tone="bg-indigo-50 text-indigo-700" />
      <KpiCard label="Approved Applications" value={data.kpis.sanctionedApplications} description="Sanctioned applications" mark="✓" tone="bg-emerald-50 text-emerald-700" />
      <KpiCard label="Active Leads" value={data.kpis.activeLeads} description="Excludes lost and on-hold leads" mark="↗" tone="bg-teal-50 text-teal-700" />
      <KpiCard label="Applications In Progress" value={data.kpis.applicationsInProgress} description="Phase 6 processing stages" mark="→" tone="bg-amber-50 text-amber-700" />
      <KpiCard label="Rejected Applications" value={data.kpis.rejectedApplications} description="Historical records retained" mark="!" tone="bg-red-50 text-red-700" />
      <KpiCard label="Pending Queries" value={data.kpis.pendingQueries} description="Open, assigned, or in progress" mark="?" tone="bg-orange-50 text-orange-700" />
    </section>

    <section className="grid gap-5 xl:grid-cols-2"><Card title="Lead Overview"><p className="mt-1 text-sm text-slate-500">Status distribution</p><BarList rows={data.leadOverview.byStatus} empty="No lead activity for the selected period." /><div className="mt-6 border-t pt-5"><p className="text-sm font-medium text-slate-700">Lead sources</p><BarList rows={data.leadOverview.bySource} empty="No lead-source data for the selected period." /></div></Card><Card title="Application Overview"><p className="mt-1 text-sm text-slate-500">Phase 1–6 application statuses</p><BarList rows={data.applicationOverview.byStatus} empty="No application activity for the selected period." /></Card></section>

    <section className="grid gap-5 xl:grid-cols-3"><Card title="Applications by Product"><BarList rows={data.products} empty="No product applications for the selected period." /></Card><Card title="Applications by Lender"><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Lender</th><th className="pb-2 text-right">Applications</th><th className="pb-2 text-right">Approved</th></tr></thead><tbody>{data.lenders.length ? data.lenders.map(lender => <tr key={lender.name} className="border-t border-slate-100"><td className="py-3 pr-2 text-slate-700">{lender.name}</td><td className="py-3 text-right">{number.format(lender.applications)}</td><td className="py-3 text-right font-semibold text-emerald-700">{number.format(lender.approved)}</td></tr>) : <tr><td colSpan={3} className="pt-4 text-slate-500">No lender applications for the selected period.</td></tr>}</tbody></table></div></Card><Card title="Document Operations"><p className="mt-2 text-3xl font-bold">{number.format(data.documents.total)}</p><p className="text-sm text-slate-500">Documents in reporting period</p><BarList rows={documentRows} empty="No document activity for the selected period." /></Card></section>

    <section className="grid gap-5 xl:grid-cols-2"><Card title="Workflow Snapshot"><p className="mt-1 text-sm text-slate-500">Persisted Phase 1–6 records; this does not change workflow state.</p><ol className="mt-4 space-y-3">{data.funnel.map((step, index) => <li key={step.label} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-brand">{index + 1}</span><span className="flex-1 text-sm text-slate-700">{step.label}</span><span className="font-semibold text-slate-900">{number.format(step.count)}</span></li>)}</ol></Card><Card title="Operational Summary"><div className="mt-4 grid gap-5 sm:grid-cols-3"><div><p className="text-sm font-medium text-slate-700">Queries</p><p className="mt-1 text-2xl font-bold">{number.format(data.operations.queries.total)}</p><BarList rows={data.operations.queries.byStatus} empty="No queries." /></div><div><p className="text-sm font-medium text-slate-700">Credit Assessments</p><p className="mt-1 text-2xl font-bold">{number.format(data.operations.credit.total)}</p><BarList rows={data.operations.credit.byStatus} empty="No assessments." /></div><div><p className="text-sm font-medium text-slate-700">Sanctions</p><p className="mt-1 text-2xl font-bold">{number.format(data.operations.sanctions.total)}</p><p className="mt-3 text-sm text-emerald-700">Accepted: {number.format(data.operations.sanctions.accepted)}</p><p className="mt-1 text-sm text-amber-700">Pending acceptance: {number.format(data.operations.sanctions.pendingAcceptance)}</p></div></div></Card></section>

    <Card title="Recent Activity">{data.activity.available ? (data.activity.items.length ? <ol className="mt-4 divide-y divide-slate-100">{data.activity.items.map(item => <li key={item.id} className="flex gap-3 py-3"><span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" /><div><p className="text-sm font-medium text-slate-800">{title(item.module)} {title(item.action)}</p><p className="text-xs text-slate-500">{title(item.entityType)} · {new Date(item.createdAt).toLocaleString()}</p></div></li>)}</ol> : <p className="mt-4 text-sm text-slate-500">No recent activity for the selected period.</p>) : <p className="mt-4 text-sm text-slate-500">Activity history is unavailable for your role.</p>}</Card>
  </div>;
}
