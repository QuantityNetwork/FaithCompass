import type {
  AutopilotPlanRow,
  AutopilotRuleRow,
  ClosingChecklistRow,
  DocumentRequestRow,
} from "@/domain/entities";
import type { DomainStore, Patch, PropertyFilter, TenantScope } from "@/server/store/types";

/**
 * Domain data bound to one tenant scope. Tool handlers only ever receive this
 * wrapper, so they cannot address another organization or environment:
 * reads are filtered by scope and writes are stamped with it.
 */
export function scopedData(store: DomainStore, scope: TenantScope) {
  const stamp = <T extends { organization_id: string; environment: string }>(row: T): T => ({
    ...row,
    organization_id: scope.organizationId,
    environment: scope.environment,
  });

  return {
    scope,
    listProperties: (filter?: PropertyFilter) => store.listProperties(scope, filter),
    getProperty: (id: string) => store.getProperty(scope, id),
    getPropertyByReference: (ref: string) => store.getPropertyByReference(scope, ref),
    listTransactions: (filter?: Parameters<DomainStore["listTransactions"]>[1]) => store.listTransactions(scope, filter),
    getTransaction: (id: string) => store.getTransaction(scope, id),
    getTransactionByReference: (ref: string) => store.getTransactionByReference(scope, ref),
    listLoans: (filter: { propertyId?: string; transactionId?: string }) => store.listLoans(scope, filter),
    listMilestones: (transactionId: string) => store.listMilestones(scope, transactionId),
    listBlockers: (transactionId: string) => store.listBlockers(scope, transactionId),
    listDocuments: (filter: { propertyId?: string; transactionId?: string }) => store.listDocuments(scope, filter),
    getDocument: (id: string) => store.getDocument(scope, id),
    insertDocumentRequest: (row: DocumentRequestRow) => store.insertDocumentRequest(stamp(row)),
    getDocumentRequest: (id: string) => store.getDocumentRequest(scope, id),
    updateDocumentRequest: (id: string, patch: Patch<DocumentRequestRow>) => store.updateDocumentRequest(scope, id, patch),
    insertChecklist: (row: ClosingChecklistRow) => store.insertChecklist(stamp(row)),
    supersedeChecklists: (transactionId: string, exceptId: string) => store.supersedeChecklists(scope, transactionId, exceptId),
    listObligations: (filter?: { propertyId?: string }) => store.listObligations(scope, filter),
    insertAutopilotPlan: (row: AutopilotPlanRow) => store.insertAutopilotPlan(stamp(row)),
    getAutopilotPlan: (id: string) => store.getAutopilotPlan(scope, id),
    updateAutopilotPlan: (id: string, patch: Patch<AutopilotPlanRow>) => store.updateAutopilotPlan(scope, id, patch),
    listAutopilotPlans: (filter: { propertyId?: string }) => store.listAutopilotPlans(scope, filter),
    listAutopilotRules: (filter: { propertyId?: string }) => store.listAutopilotRules(scope, filter),
    insertAutopilotRules: (rows: AutopilotRuleRow[]) => store.insertAutopilotRules(rows.map(stamp)),
    updateAutopilotRule: (id: string, patch: Patch<AutopilotRuleRow>) => store.updateAutopilotRule(scope, id, patch),
    getOwnershipRecord: (propertyId: string) => store.getOwnershipRecord(scope, propertyId),
    listHomebookEntries: (propertyId: string) => store.listHomebookEntries(scope, propertyId),
    listIntegrationConnections: () => store.listIntegrationConnections(scope),
  };
}

export type ScopedData = ReturnType<typeof scopedData>;
