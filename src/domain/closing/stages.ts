import type { ClosingStage } from "../entities";

export const STAGE_META: Record<ClosingStage, { label: string; description: string }> = {
  offer: { label: "Offer", description: "Offer accepted by the seller." },
  contract: { label: "Contract", description: "Purchase agreement fully executed." },
  financing: { label: "Financing", description: "Loan approved and cleared to close." },
  inspection: { label: "Inspection", description: "Inspections completed and repairs negotiated." },
  title: { label: "Title", description: "Title commitment issued and requirements cleared." },
  insurance: { label: "Insurance", description: "Homeowner's insurance bound and accepted by the lender." },
  escrow: { label: "Escrow", description: "Escrow opened and earnest money received." },
  funds: { label: "Funds", description: "Cash to close confirmed by the settlement agent." },
  signing: { label: "Signing", description: "Closing documents signed." },
  recording: { label: "Recording", description: "Deed recorded with the county." },
  ownership: { label: "Ownership", description: "Ownership begins; Sagolik transitions to ownership." },
};

export const PARTY_LABEL: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  lender: "Lender",
  title: "Title company",
  insurance_agent: "Insurance agent",
  hoa: "HOA",
  agent: "Real-estate agent",
  sagolik: "Sagolik",
};
