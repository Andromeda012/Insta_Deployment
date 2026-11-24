const DEFAULT_SUPABASE_URL = 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const FALLBACK_SETTINGS_KEY = 'crm_unified_fallback_store';
const WORK_ORDERS_SETTINGS_KEY = 'factory_work_orders';

export const VALID_LEAD_SOURCES = new Set([
    'web',
    'whatsapp',
    'instagram',
    'facebook',
    'tiktok_youtube',
]);

export const VALID_LEAD_STATUSES = new Set([
    'yeni_talep',
    'inceleniyor',
    'fiyat_verildi',
    'onaylandi',
    'iptal',
]);

function getSupabaseConfig() {
    const url = (
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        DEFAULT_SUPABASE_URL
    ).replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        '';
    return {
        url,
        key: serviceKey || anonKey,
        hasServiceRole: Boolean(serviceKey),
    };
}

function isMissingRelationError(status, errorText = '') {
    const lower = String(errorText || '').toLowerCase();
    return (
        status === 404 ||
        lower.includes('pgrst205') ||
        lower.includes('could not find the table') ||
        lower.includes('could not find the function') ||
        lower.includes('does not exist')
    );
}

export async function supabaseRest(path, { method = 'GET', body, headers = {} } = {}) {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
        return {
            ok: false,
            status: 500,
            data: null,
            errorText: 'Supabase yapılandırması eksik',
            isMissingRelation: false,
        };
    }

    const reqHeaders = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...headers,
    };

    const res = await fetch(`${url}${path}`, {
        method,
        headers: reqHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        const errMsg =
            typeof data === 'object' && data !== null
                ? JSON.stringify(data)
                : String(text || res.statusText);
        return {
            ok: false,
            status: res.status,
            data,
            errorText: errMsg,
            isMissingRelation: isMissingRelationError(res.status, errMsg),
        };
    }

    return {
        ok: true,
        status: res.status,
        data,
        errorText: '',
        isMissingRelation: false,
    };
}

export function normalizeTurkishPhone(rawPhone) {
    if (!rawPhone) return '';
    let digits = String(rawPhone).trim().replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    if (digits.length === 10 && digits.startsWith('5')) {
        digits = '90' + digits;
    } else if (digits.length === 11 && digits.startsWith('05')) {
        digits = '9' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = '90' + digits.slice(1);
    } else if (digits.length === 10) {
        digits = '90' + digits;
    }

    return '+' + digits;
}

export function normalizeLeadSource(source) {
    const clean = String(source || 'web').trim().toLowerCase();
    return VALID_LEAD_SOURCES.has(clean) ? clean : 'web';
}

export function normalizeLeadStatus(status) {
    const clean = String(status || 'yeni_talep').trim().toLowerCase();
    return VALID_LEAD_STATUSES.has(clean) ? clean : 'yeni_talep';
}

export function generateReferenceCode() {
    const yr = new Date().getUTCFullYear();
    const num = Math.floor(1000 + Math.random() * 9000);
    return `GM-${yr}-${num}`;
}

function sanitizeProductDetails(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const copy = {};
    for (const [k, v] of Object.entries(raw)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            copy[k] = v;
        }
    }
    return copy;
}

function createUuidLike() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Geçici Migration Fallback Deposu (SQL Migration henüz çalıştırılmamışsa)
// SQL çalıştırıldığı anda otomatik olarak gerçek Postgres tablolarına geçer.
// ---------------------------------------------------------------------------
async function readFallbackStore() {
    const res = await supabaseRest(
        `/rest/v1/site_settings?key=eq.${encodeURIComponent(FALLBACK_SETTINGS_KEY)}&select=data&limit=1`
    );
    if (!res.ok || !Array.isArray(res.data) || !res.data.length) {
        return { customers: [], leads: [] };
    }
    const raw = res.data[0]?.data || {};
    return {
        customers: Array.isArray(raw.customers) ? raw.customers : [],
        leads: Array.isArray(raw.leads) ? raw.leads : [],
    };
}

async function writeFallbackStore(store) {
    return supabaseRest('/rest/v1/site_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: {
            key: FALLBACK_SETTINGS_KEY,
            data: store,
            updated_at: new Date().toISOString(),
        },
    });
}

async function readWorkOrdersStore() {
    const res = await supabaseRest(
        `/rest/v1/site_settings?key=eq.${WORK_ORDERS_SETTINGS_KEY}&select=data&limit=1`
    );
    const d = res.ok && Array.isArray(res.data) && res.data[0]?.data ? res.data[0].data : {};
    return {
        orders: Array.isArray(d.orders) ? d.orders : [],
        images: d.images && typeof d.images === 'object' ? d.images : {},
    };
}

async function getWorkOrdersList() {
    const store = await readWorkOrdersStore();
    return store.orders;
}

async function saveWorkOrdersList(list) {
    const existingStore = await readWorkOrdersStore();
    return supabaseRest('/rest/v1/site_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: {
            key: WORK_ORDERS_SETTINGS_KEY,
            data: {
                ...existingStore,
                orders: Array.isArray(list) ? list.slice(0, 500) : [],
                updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
        },
    });
}

// ---------------------------------------------------------------------------
// 1. Lazy Register Teklif Talebi Oluşturma (Public / Üyeliksiz & Üyeli)
// ---------------------------------------------------------------------------
export async function submitLazyQuote(payload = {}, { verifiedClerkUserId = null } = {}) {
    const fullName = String(payload.full_name || payload.name || '').trim();
    const normPhone = normalizeTurkishPhone(payload.phone || '');
    const cleanEmail = payload.email ? String(payload.email).trim().toLowerCase() : null;
    const city = payload.city ? String(payload.city).trim() : null;
    const igHandle = payload.instagram_handle ? String(payload.instagram_handle).trim() : null;
    const source = normalizeLeadSource(payload.source || 'web');
    const collectionName = String(payload.collection_name || payload.collection || payload.module || '').trim();
    const productDetails = sanitizeProductDetails(payload.product_details);

    if (!fullName || normPhone.replace(/\D/g, '').length < 7) {
        return {
            ok: false,
            status: 400,
            error: 'Lütfen ad soyad ve geçerli bir telefon numarası giriniz.',
        };
    }

    const existingCustRes = await supabaseRest(
        `/rest/v1/customers?phone=eq.${encodeURIComponent(normPhone)}&select=*&limit=1`
    );

    if (existingCustRes.isMissingRelation) {
        return submitLazyQuoteFallback({
            fullName,
            normPhone,
            cleanEmail,
            city,
            igHandle,
            source,
            collectionName,
            productDetails,
            verifiedClerkUserId,
        });
    }

    if (!existingCustRes.ok) {
        return { ok: false, status: existingCustRes.status, error: existingCustRes.errorText };
    }

    let customer = Array.isArray(existingCustRes.data) && existingCustRes.data[0] ? existingCustRes.data[0] : null;
    let claimedExisting = false;

    if (!customer) {
        const insertCust = await supabaseRest('/rest/v1/customers', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: {
                clerk_user_id: verifiedClerkUserId || null,
                full_name: fullName,
                phone: normPhone,
                email: cleanEmail,
                city,
                instagram_handle: igHandle,
            },
        });
        if (!insertCust.ok || !Array.isArray(insertCust.data) || !insertCust.data[0]) {
            return {
                ok: false,
                status: insertCust.status || 500,
                error: insertCust.errorText || 'Müşteri kaydı oluşturulamadı.',
            };
        }
        customer = insertCust.data[0];
    } else {
        const patch = {};
        if (!customer.clerk_user_id && verifiedClerkUserId) {
            patch.clerk_user_id = verifiedClerkUserId;
            claimedExisting = true;
        }
        if (fullName && (!customer.full_name || customer.full_name === 'Web Müşterisi')) {
            patch.full_name = fullName;
        }
        if (cleanEmail && !customer.email) patch.email = cleanEmail;
        if (city && !customer.city) patch.city = city;
        if (igHandle && !customer.instagram_handle) patch.instagram_handle = igHandle;

        if (Object.keys(patch).length > 0) {
            const updCust = await supabaseRest(
                `/rest/v1/customers?id=eq.${encodeURIComponent(customer.id)}`,
                {
                    method: 'PATCH',
                    headers: { Prefer: 'return=representation' },
                    body: patch,
                }
            );
            if (updCust.ok && Array.isArray(updCust.data) && updCust.data[0]) {
                customer = updCust.data[0];
            }
        }
    }

    const referenceCode = generateReferenceCode();
    const insertLead = await supabaseRest('/rest/v1/leads_and_quotes', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
            reference_code: referenceCode,
            customer_id: customer.id,
            source,
            collection_name: collectionName,
            product_details: productDetails,
            status: 'yeni_talep',
        },
    });

    if (!insertLead.ok || !Array.isArray(insertLead.data) || !insertLead.data[0]) {
        return {
            ok: false,
            status: insertLead.status || 500,
            error: insertLead.errorText || 'Teklif talebi kaydedilemedi.',
        };
    }

    const lead = { ...insertLead.data[0], customer };
    return {
        ok: true,
        status: 201,
        reference_code: lead.reference_code,
        customer,
        lead,
        claimed_existing_customer: claimedExisting,
        storage_mode: 'postgres',
        message:
            'Talebiniz alındı! Teklif durumunuzu dilediğiniz zaman bu telefon numarasıyla giriş yaparak takip edebilirsiniz.',
    };
}

async function submitLazyQuoteFallback(input) {
    const store = await readFallbackStore();
    const nowIso = new Date().toISOString();
    let customer = store.customers.find((c) => c.phone === input.normPhone) || null;
    let claimedExisting = false;

    if (!customer) {
        customer = {
            id: createUuidLike(),
            clerk_user_id: input.verifiedClerkUserId || null,
            full_name: input.fullName,
            phone: input.normPhone,
            email: input.cleanEmail,
            city: input.city,
            instagram_handle: input.igHandle,
            created_at: nowIso,
            updated_at: nowIso,
        };
        store.customers.unshift(customer);
    } else {
        if (!customer.clerk_user_id && input.verifiedClerkUserId) {
            customer.clerk_user_id = input.verifiedClerkUserId;
            claimedExisting = true;
        }
        if (input.fullName && !customer.full_name) customer.full_name = input.fullName;
        if (input.cleanEmail && !customer.email) customer.email = input.cleanEmail;
        if (input.city && !customer.city) customer.city = input.city;
        if (input.igHandle && !customer.instagram_handle) customer.instagram_handle = input.igHandle;
        customer.updated_at = nowIso;
    }

    const referenceCode = generateReferenceCode();
    const lead = {
        id: createUuidLike(),
        reference_code: referenceCode,
        customer_id: customer.id,
        source: input.source,
        collection_name: input.collectionName,
        product_details: input.productDetails,
        status: 'yeni_talep',
        quoted_price: null,
        staff_note: null,
        ai_summary: null,
        assigned_staff_id: null,
        erp_order_id: null,
        created_at: nowIso,
        updated_at: nowIso,
    };
    store.leads.unshift(lead);
    await writeFallbackStore(store);

    return {
        ok: true,
        status: 201,
        reference_code: lead.reference_code,
        customer,
        lead: { ...lead, customer },
        claimed_existing_customer: claimedExisting,
        storage_mode: 'fallback_site_settings',
        migration_required: true,
        message:
            'Talebiniz alındı! Teklif durumunuzu dilediğiniz zaman bu telefon numarasıyla giriş yaparak takip edebilirsiniz.',
    };
}

// ---------------------------------------------------------------------------
// 2. Clerk Hesap Sahiplenme (Account Claiming) & Müşteri Taleplerini Getirme
// ---------------------------------------------------------------------------
export async function claimCustomerAccount({ clerkUserId, phone, email, fullName } = {}) {
    if (!clerkUserId) {
        return { ok: false, status: 400, error: 'clerkUserId zorunludur.' };
    }

    const normPhone = phone ? normalizeTurkishPhone(phone) : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanName = fullName ? String(fullName).trim() : null;

    const rpcRes = await supabaseRest('/rest/v1/rpc/claim_customer_by_clerk', {
        method: 'POST',
        body: {
            p_clerk_user_id: clerkUserId,
            p_phone: normPhone,
            p_email: cleanEmail,
            p_full_name: cleanName,
        },
    });

    if (rpcRes.isMissingRelation) {
        return claimCustomerAccountFallback({
            clerkUserId,
            normPhone,
            cleanEmail,
            cleanName,
        });
    }

    if (!rpcRes.ok) {
        return { ok: false, status: rpcRes.status, error: rpcRes.errorText };
    }

    const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
    const customerId = row?.customer_id || null;
    const claimedNow = Boolean(row?.claimed_now);

    if (!customerId) {
        return {
            ok: true,
            claimed_count: 0,
            claimed_now: false,
            customer: null,
            leads: [],
            storage_mode: 'postgres',
        };
    }

    const [custRes, leadsRes] = await Promise.all([
        supabaseRest(`/rest/v1/customers?id=eq.${encodeURIComponent(customerId)}&select=*&limit=1`),
        supabaseRest(
            `/rest/v1/leads_and_quotes?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc`
        ),
    ]);

    const customer = Array.isArray(custRes.data) && custRes.data[0] ? custRes.data[0] : null;
    const leads = Array.isArray(leadsRes.data)
        ? leadsRes.data.map((l) => ({ ...l, customer }))
        : [];

    return {
        ok: true,
        claimed_count: Number(row?.linked_leads_count ?? leads.length),
        claimed_now: claimedNow,
        customer,
        leads,
        storage_mode: 'postgres',
    };
}

async function claimCustomerAccountFallback({ clerkUserId, normPhone, cleanEmail, cleanName }) {
    const store = await readFallbackStore();
    const nowIso = new Date().toISOString();

    let existing = store.customers.find((c) => c.clerk_user_id === clerkUserId) || null;
    const byPhone = normPhone ? store.customers.find((c) => c.phone === normPhone) || null : null;
    const byEmail =
        !byPhone && cleanEmail
            ? store.customers.find(
                  (c) => String(c.email || '').toLowerCase() === cleanEmail && !c.clerk_user_id
              ) ||
              store.customers.find((c) => String(c.email || '').toLowerCase() === cleanEmail) ||
              null
            : null;

    let claimedNow = false;
    let target = existing;

    if (existing) {
        if (byPhone && byPhone.id !== existing.id && !byPhone.clerk_user_id) {
            store.leads.forEach((l) => {
                if (l.customer_id === byPhone.id) l.customer_id = existing.id;
            });
            store.customers = store.customers.filter((c) => c.id !== byPhone.id);
            claimedNow = true;
        }
        if (cleanName && !existing.full_name) existing.full_name = cleanName;
        if (cleanEmail && !existing.email) existing.email = cleanEmail;
        existing.updated_at = nowIso;
    } else if (byPhone && !byPhone.clerk_user_id) {
        byPhone.clerk_user_id = clerkUserId;
        if (cleanEmail && !byPhone.email) byPhone.email = cleanEmail;
        if (cleanName && !byPhone.full_name) byPhone.full_name = cleanName;
        byPhone.updated_at = nowIso;
        target = byPhone;
        claimedNow = true;
    } else if (byEmail && !byEmail.clerk_user_id) {
        byEmail.clerk_user_id = clerkUserId;
        if (normPhone && !byEmail.phone) byEmail.phone = normPhone;
        if (cleanName && !byEmail.full_name) byEmail.full_name = cleanName;
        byEmail.updated_at = nowIso;
        target = byEmail;
        claimedNow = true;
    } else if (normPhone || cleanEmail) {
        target = {
            id: createUuidLike(),
            clerk_user_id: clerkUserId,
            full_name: cleanName || 'Web Müşterisi',
            phone: normPhone || `clerk:${clerkUserId}`,
            email: cleanEmail,
            city: null,
            instagram_handle: null,
            created_at: nowIso,
            updated_at: nowIso,
        };
        store.customers.unshift(target);
    }

    await writeFallbackStore(store);

    const leads = target
        ? store.leads
              .filter((l) => l.customer_id === target.id)
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map((l) => ({ ...l, customer: target }))
        : [];

    return {
        ok: true,
        claimed_count: leads.length,
        claimed_now: claimedNow,
        customer: target,
        leads,
        storage_mode: 'fallback_site_settings',
        migration_required: true,
    };
}

export async function listCustomerLeads({ clerkUserId, phone, email, fullName } = {}) {
    return claimCustomerAccount({ clerkUserId, phone, email, fullName });
}

export async function customerRespondToLead({ clerkUserId, leadId, decision } = {}) {
    const cleanDecision = String(decision || '').trim().toLowerCase();
    if (!clerkUserId || !leadId || !['onaylandi', 'iptal'].includes(cleanDecision)) {
        return { ok: false, status: 400, error: 'Geçersiz müşteri onay/iptal isteği.' };
    }

    const custRes = await supabaseRest(
        `/rest/v1/customers?clerk_user_id=eq.${encodeURIComponent(clerkUserId)}&select=*&limit=1`
    );

    if (custRes.isMissingRelation) {
        const store = await readFallbackStore();
        const cust = store.customers.find((c) => c.clerk_user_id === clerkUserId);
        if (!cust) return { ok: false, status: 403, error: 'Bu talebe erişim yetkiniz yok.' };
        const lead = store.leads.find((l) => l.id === leadId && l.customer_id === cust.id);
        if (!lead) return { ok: false, status: 404, error: 'Talep bulunamadı.' };
        lead.status = cleanDecision;
        lead.updated_at = new Date().toISOString();
        await writeFallbackStore(store);
        return { ok: true, lead: { ...lead, customer: cust }, storage_mode: 'fallback_site_settings' };
    }

    const customer = Array.isArray(custRes.data) && custRes.data[0] ? custRes.data[0] : null;
    if (!customer) {
        return { ok: false, status: 403, error: 'Müşteri hesabı eşleşmedi.' };
    }

    const leadRes = await supabaseRest(
        `/rest/v1/leads_and_quotes?id=eq.${encodeURIComponent(leadId)}&customer_id=eq.${encodeURIComponent(customer.id)}&select=*&limit=1`
    );
    const lead = Array.isArray(leadRes.data) && leadRes.data[0] ? leadRes.data[0] : null;
    if (!lead) {
        return { ok: false, status: 404, error: 'Talep bulunamadı veya bu hesaba ait değil.' };
    }

    const upd = await supabaseRest(
        `/rest/v1/leads_and_quotes?id=eq.${encodeURIComponent(leadId)}`,
        {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: { status: cleanDecision },
        }
    );

    if (!upd.ok || !Array.isArray(upd.data) || !upd.data[0]) {
        return { ok: false, status: upd.status || 500, error: upd.errorText || 'Güncellenemedi.' };
    }

    return { ok: true, lead: { ...upd.data[0], customer }, storage_mode: 'postgres' };
}

// ---------------------------------------------------------------------------
// 3. ERP CRM Ekranı Listeleme, Güncelleme & Siparişe Dönüştürme (Staff/Admin)
// ---------------------------------------------------------------------------
export async function listCrmLeadsAndCustomers({ source = 'all', status = 'all', search = '', limit = 250 } = {}) {
    const cleanSource = String(source || 'all').trim().toLowerCase();
    const cleanStatus = String(status || 'all').trim().toLowerCase();
    const cleanSearch = String(search || '').trim().toLowerCase();
    const safeLimit = Math.min(Math.max(Number(limit) || 250, 1), 1000);

    const [leadsRes, custsRes, workOrders] = await Promise.all([
        supabaseRest(`/rest/v1/leads_and_quotes?select=*&order=created_at.desc&limit=${safeLimit}`),
        supabaseRest('/rest/v1/customers?select=*&order=updated_at.desc&limit=1000'),
        getWorkOrdersList(),
    ]);

    let storageMode = 'postgres';
    let migrationRequired = false;
    let allLeads = [];
    let allCustomers = [];

    if (leadsRes.isMissingRelation || custsRes.isMissingRelation) {
        storageMode = 'fallback_site_settings';
        migrationRequired = true;
        const store = await readFallbackStore();
        allLeads = store.leads;
        allCustomers = store.customers;
    } else {
        if (!leadsRes.ok) {
            return { ok: false, status: leadsRes.status, error: leadsRes.errorText };
        }
        allLeads = Array.isArray(leadsRes.data) ? leadsRes.data : [];
        allCustomers = Array.isArray(custsRes.data) ? custsRes.data : [];
    }

    const custMap = new Map(allCustomers.map((c) => [c.id, c]));
    const woByTrack = new Map(workOrders.map((w) => [String(w.trackingCode || w.id), w]));

    const hydratedLeads = allLeads
        .map((lead) => {
            const customer = custMap.get(lead.customer_id) || null;
            const workOrder = lead.erp_order_id ? woByTrack.get(String(lead.erp_order_id)) || null : null;
            return {
                ...lead,
                customer,
                work_order_stage: workOrder?.currentStage || null,
            };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const bySource = { web: 0, whatsapp: 0, instagram: 0, facebook: 0, tiktok_youtube: 0 };
    const byStatus = { yeni_talep: 0, inceleniyor: 0, fiyat_verildi: 0, onaylandi: 0, iptal: 0 };

    for (const lead of hydratedLeads) {
        if (bySource[lead.source] !== undefined) bySource[lead.source] += 1;
        if (byStatus[lead.status] !== undefined) byStatus[lead.status] += 1;
    }

    const filteredLeads = hydratedLeads.filter((lead) => {
        if (cleanSource !== 'all' && lead.source !== cleanSource) return false;
        if (cleanStatus !== 'all' && lead.status !== cleanStatus) return false;
        if (cleanSearch) {
            const hay = [
                lead.reference_code,
                lead.collection_name,
                lead.staff_note,
                lead.ai_summary,
                lead.erp_order_id,
                lead.customer?.full_name,
                lead.customer?.phone,
                lead.customer?.email,
                lead.customer?.city,
                lead.customer?.instagram_handle,
                JSON.stringify(lead.product_details || {}),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!hay.includes(cleanSearch)) return false;
        }
        return true;
    });

    const customersWithCount = allCustomers.map((c) => ({
        ...c,
        leads_count: hydratedLeads.filter((l) => l.customer_id === c.id).length,
    }));

    return {
        ok: true,
        storage_mode: storageMode,
        migration_required: migrationRequired,
        leads: filteredLeads,
        customers: customersWithCount,
        stats: {
            totalLeads: hydratedLeads.length,
            totalCustomers: allCustomers.length,
            claimedCustomers: allCustomers.filter((c) => Boolean(c.clerk_user_id)).length,
            bySource,
            byStatus,
        },
    };
}

export async function updateCrmLead({
    leadId,
    status,
    quotedPrice,
    staffNote,
    aiSummary,
    assignedStaffId,
} = {}) {
    if (!leadId) {
        return { ok: false, status: 400, error: 'leadId zorunludur.' };
    }

    const patch = {};
    if (quotedPrice !== undefined && quotedPrice !== null && quotedPrice !== '') {
        const parsed = Number(quotedPrice);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return { ok: false, status: 400, error: 'Geçersiz fiyat değeri.' };
        }
        patch.quoted_price = parsed;
    } else if (quotedPrice === null || quotedPrice === '') {
        patch.quoted_price = null;
    }

    if (staffNote !== undefined) patch.staff_note = staffNote === null ? null : String(staffNote);
    if (aiSummary !== undefined) patch.ai_summary = aiSummary === null ? null : String(aiSummary);
    if (assignedStaffId !== undefined) patch.assigned_staff_id = assignedStaffId;

    if (status !== undefined) {
        patch.status = normalizeLeadStatus(status);
    } else if (patch.quoted_price !== undefined && patch.quoted_price !== null) {
        patch.status = 'fiyat_verildi';
    }

    const checkRes = await supabaseRest(
        `/rest/v1/leads_and_quotes?id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`
    );

    if (checkRes.isMissingRelation) {
        const store = await readFallbackStore();
        const lead = store.leads.find((l) => l.id === leadId);
        if (!lead) return { ok: false, status: 404, error: 'Talep bulunamadı.' };
        if (patch.status !== undefined) lead.status = patch.status;
        if (patch.quoted_price !== undefined) lead.quoted_price = patch.quoted_price;
        if (patch.staff_note !== undefined) lead.staff_note = patch.staff_note;
        if (patch.ai_summary !== undefined) lead.ai_summary = patch.ai_summary;
        if (patch.assigned_staff_id !== undefined) lead.assigned_staff_id = patch.assigned_staff_id;
        lead.updated_at = new Date().toISOString();
        await writeFallbackStore(store);
        const customer = store.customers.find((c) => c.id === lead.customer_id) || null;
        return { ok: true, lead: { ...lead, customer }, storage_mode: 'fallback_site_settings' };
    }

    const upd = await supabaseRest(
        `/rest/v1/leads_and_quotes?id=eq.${encodeURIComponent(leadId)}`,
        {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: patch,
        }
    );

    if (!upd.ok || !Array.isArray(upd.data) || !upd.data[0]) {
        return { ok: false, status: upd.status || 500, error: upd.errorText || 'Güncellenemedi.' };
    }

    const lead = upd.data[0];
    const custRes = await supabaseRest(
        `/rest/v1/customers?id=eq.${encodeURIComponent(lead.customer_id)}&select=*&limit=1`
    );
    const customer = Array.isArray(custRes.data) && custRes.data[0] ? custRes.data[0] : null;
    return { ok: true, lead: { ...lead, customer }, storage_mode: 'postgres' };
}

export async function convertApprovedLeadToWorkOrder({ leadId, staffUserId, staffName } = {}) {
    if (!leadId) {
        return { ok: false, status: 400, error: 'leadId zorunludur.' };
    }

    const leadRes = await supabaseRest(
        `/rest/v1/leads_and_quotes?id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`
    );

    let storageMode = 'postgres';
    let lead = null;
    let customer = null;
    let fallbackStore = null;

    if (leadRes.isMissingRelation) {
        storageMode = 'fallback_site_settings';
        fallbackStore = await readFallbackStore();
        lead = fallbackStore.leads.find((l) => l.id === leadId) || null;
        if (lead) {
            customer = fallbackStore.customers.find((c) => c.id === lead.customer_id) || null;
        }
    } else {
        lead = Array.isArray(leadRes.data) && leadRes.data[0] ? leadRes.data[0] : null;
        if (lead) {
            const custRes = await supabaseRest(
                `/rest/v1/customers?id=eq.${encodeURIComponent(lead.customer_id)}&select=*&limit=1`
            );
            customer = Array.isArray(custRes.data) && custRes.data[0] ? custRes.data[0] : null;
        }
    }

    if (!lead) {
        return { ok: false, status: 404, error: 'Talep bulunamadı.' };
    }

    if (lead.erp_order_id) {
        return {
            ok: true,
            already_converted: true,
            erp_order_id: lead.erp_order_id,
            lead: { ...lead, customer },
            storage_mode: storageMode,
            message: 'Bu talep zaten üretim iş emrine dönüştürülmüş.',
        };
    }

    const workOrders = await getWorkOrdersList();
    const trackingCode = lead.reference_code || generateReferenceCode();
    const nowIso = new Date().toISOString();
    const details = lead.product_details || {};
    const modulesList = Array.isArray(details.modules)
        ? details.modules
        : details.module
        ? [details.module]
        : [];

    const newOrder = {
        id: 'wo_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        orderNumber: trackingCode,
        trackingCode,
        leadId: lead.id,
        customerId: lead.customer_id,
        customerName: customer?.full_name || 'Müşteri',
        customerPhone: customer?.phone || '',
        customerCity: customer?.city || '',
        source: lead.source,
        productTitle: lead.collection_name || 'Özel Modül Tasarımı',
        membraneColor: details.finish_color || details.color || 'Özel Kartela',
        modelPattern: modulesList.length ? modulesList.join(', ') : (lead.collection_name || 'Standart Modül'),
        dimensions: details.dimensions || '',
        notes: lead.staff_note || details.notes || '',
        quotedPrice: lead.quoted_price ?? null,
        partCount: Math.max(1, modulesList.length || 1),
        totalAreaM2: 0,
        priority: 'normal',
        currentStage: 'cizim',
        estimatedDelivery: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
        stageHistory: [
            {
                stageId: 'cizim',
                stageName: 'Teknik Çizim & Ölçü',
                timestamp: nowIso,
                user: staffName || 'CRM Satış Ekibi',
            },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
    };

    const existingWoIdx = workOrders.findIndex(
        (w) => String(w.trackingCode) === String(trackingCode) || (w.leadId && w.leadId === lead.id)
    );
    if (existingWoIdx >= 0) {
        workOrders[existingWoIdx] = { ...workOrders[existingWoIdx], ...newOrder };
    } else {
        workOrders.unshift(newOrder);
    }

    const saveWoRes = await saveWorkOrdersList(workOrders);
    if (!saveWoRes.ok) {
        return {
            ok: false,
            status: saveWoRes.status || 500,
            error: saveWoRes.errorText || 'Atölye iş emri oluşturulamadı.',
        };
    }

    let updatedLead = null;
    if (fallbackStore) {
        lead.status = 'onaylandi';
        lead.erp_order_id = trackingCode;
        lead.assigned_staff_id = staffUserId || lead.assigned_staff_id || null;
        lead.updated_at = nowIso;
        await writeFallbackStore(fallbackStore);
        updatedLead = { ...lead, customer };
    } else {
        const upd = await supabaseRest(
            `/rest/v1/leads_and_quotes?id=eq.${encodeURIComponent(lead.id)}`,
            {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: {
                    status: 'onaylandi',
                    erp_order_id: trackingCode,
                    assigned_staff_id: staffUserId || lead.assigned_staff_id || null,
                },
            }
        );
        updatedLead = Array.isArray(upd.data) && upd.data[0]
            ? { ...upd.data[0], customer }
            : { ...lead, status: 'onaylandi', erp_order_id: trackingCode, customer };
    }

    return {
        ok: true,
        erp_order_id: trackingCode,
        work_order: newOrder,
        lead: updatedLead,
        storage_mode: storageMode,
        message: `${trackingCode} kodlu talep Modül 4 Fabrika Atölye Takip hattına aktarıldı.`,
    };
}

// ---------------------------------------------------------------------------
// 4. Kamu Takip Sorgusu (?track=GM-2026-...)
// ---------------------------------------------------------------------------
export async function findLeadByReferenceCode(refCode) {
    const clean = String(refCode || '').trim().toUpperCase();
    if (!clean) return null;

    const res = await supabaseRest(
        `/rest/v1/leads_and_quotes?reference_code=eq.${encodeURIComponent(clean)}&select=*&limit=1`
    );
    if (res.isMissingRelation) {
        const store = await readFallbackStore();
        const lead = store.leads.find((l) => String(l.reference_code || '').toUpperCase() === clean);
        if (!lead) return null;
        const customer = store.customers.find((c) => c.id === lead.customer_id) || null;
        return { ...lead, customer };
    }
    if (!res.ok || !Array.isArray(res.data) || !res.data[0]) return null;
    const lead = res.data[0];
    const custRes = await supabaseRest(
        `/rest/v1/customers?id=eq.${encodeURIComponent(lead.customer_id)}&select=*&limit=1`
    );
    const customer = Array.isArray(custRes.data) && custRes.data[0] ? custRes.data[0] : null;
    return { ...lead, customer };
}
