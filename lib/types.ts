export type BusinessCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'bakery'
  | 'food_truck'
  | 'night_market'
  | 'other'

export type LeadStatus =
  | 'prospect'
  | 'contacted'
  | 'interested'
  | 'negotiating'
  | 'closed_won'
  | 'closed_lost'

export type PainPoint =
  | 'low_foot_traffic'
  | 'no_online_presence'
  | 'poor_reviews'
  | 'high_competition'
  | 'no_loyalty_program'
  | 'manual_ordering'
  | 'food_waste'
  | 'staff_shortage'

export type Priority = 'high' | 'medium' | 'low'

export type InteractionType = 'call' | 'email' | 'meeting' | 'demo' | 'proposal' | 'whatsapp'

export interface Business {
  id: string
  name: string
  category: BusinessCategory
  address: string
  district: string
  city: string
  phone?: string
  email?: string
  googleRating?: number
  reviewCount?: number
  hasApp: boolean
  hasOnlineOrdering: boolean
  hasLoyaltyProgram: boolean
  employeeCount?: number
  painPoints: PainPoint[]
  lat: number
  lng: number
  tags: string[]
}

export interface Lead {
  id: string
  businessId: string
  businessName: string
  businessCategory: BusinessCategory
  status: LeadStatus
  assignedTo: string
  priority: Priority
  estimatedValue: number
  nextFollowUp?: string
  notes: string
  createdAt: string
  updatedAt: string
  contacts: Contact[]
  interactions: Interaction[]
}

export interface Contact {
  id: string
  businessId: string
  name: string
  role: string
  phone?: string
  email?: string
  line?: string
}

export interface Interaction {
  id: string
  leadId: string
  type: InteractionType
  date: string
  summary: string
  outcome: 'positive' | 'neutral' | 'negative'
  nextAction?: string
  createdBy: string
}

export interface ChangeLog {
  id: string
  leadId: string
  businessName: string
  field: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
  note?: string
}

export interface AIDiagnosis {
  businessId: string
  painPoints: PainPoint[]
  suggestions: string[]
  urgency: 'critical' | 'high' | 'medium' | 'low'
  estimatedImpact: string
  recommendedApproach: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  targetPainPoints: PainPoint[]
  tone: 'formal' | 'friendly' | 'urgent'
}

export const PAIN_POINT_LABELS: Record<PainPoint, string> = {
  low_foot_traffic: '來客數不足',
  no_online_presence: '缺乏線上曝光',
  poor_reviews: '評價偏低',
  high_competition: '競爭激烈',
  no_loyalty_program: '無會員機制',
  manual_ordering: '點餐流程繁瑣',
  food_waste: '食材浪費嚴重',
  staff_shortage: '人力短缺',
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  prospect: '待開發',
  contacted: '已聯繫',
  interested: '有興趣',
  negotiating: '洽談中',
  closed_won: '已成交',
  closed_lost: '未成交',
}

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  restaurant: '餐廳',
  cafe: '咖啡廳',
  bar: '酒吧',
  bakery: '烘焙坊',
  food_truck: '餐車',
  night_market: '夜市攤',
  other: '其他',
}
