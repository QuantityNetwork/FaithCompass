-- ═══════════════════════════════════════════════════════════════════════
-- Function privileges: anonymous API callers may execute nothing.
--
-- PostgreSQL grants EXECUTE to PUBLIC on every new function, and Supabase
-- additionally grants it to anon and authenticated. sgk_verify_audit_chain
-- skips its membership check for server-side callers (no auth.uid()), and an
-- anonymous caller has no auth.uid() either, so it must not be callable by anon.
-- ═══════════════════════════════════════════════════════════════════════

revoke all on function public.sgk_verify_audit_chain(uuid) from public, anon;
grant execute on function public.sgk_verify_audit_chain(uuid) to authenticated, service_role;

-- Tenancy helpers are evaluated inside RLS policies for signed-in users only.
revoke all on function public.sgk_is_member(uuid) from public, anon;
revoke all on function public.sgk_has_role(uuid, public.sgk_member_role[]) from public, anon;
grant execute on function public.sgk_is_member(uuid), public.sgk_has_role(uuid, public.sgk_member_role[]) to authenticated, service_role;

-- Internal: trigger functions and the audit hash are not part of the API.
revoke all on function public.sgk_handle_new_user() from public, anon, authenticated;
revoke all on function public.sgk_touch_updated_at() from public, anon, authenticated;
revoke all on function public.sgk_audit_immutable() from public, anon, authenticated;
revoke all on function public.sgk_audit_hash(public.mcp_audit_logs) from public, anon, authenticated;
