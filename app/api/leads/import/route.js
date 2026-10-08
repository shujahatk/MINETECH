import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mapCsvHeaders, normalizePhoneNumber } from '@/lib/services/leadService';
import { scoreBatchWithClaude } from '@/lib/services/leadScoringService';
import { requireAuth } from '@/lib/middleware/authGuard';
import csv from 'csv-parser';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, message: 'No CSV file provided' }, { status: 400 });
    }

    const defaultTags = formData.get('tags') ? formData.get('tags').split(',').map((t) => t.trim()).filter(Boolean) : [];

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = [];

    await new Promise((resolve, reject) => {
      const stream = Readable.from(buffer.toString('utf-8'));
      stream
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'CSV file is empty' }, { status: 400 });
    }

    const columnMap = mapCsvHeaders(Object.keys(rows[0]));

    let validRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;
    const leadsToScore = [];

    // Resolve a valid Supabase UUID for assigned_to and activity_logs
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let assignedUserId = null;
    const rawUserId = auth.user?.id || auth.user?._id;
    if (rawUserId && UUID_RE.test(String(rawUserId))) {
      assignedUserId = rawUserId;
    } else {
      const { data: dbUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (dbUser?.id && UUID_RE.test(dbUser.id)) {
        assignedUserId = dbUser.id;
      }
    }

    // Pre-fetch all emails, phones, and company names from Supabase for fast deduplication
    const { data: existingLeads } = await supabaseAdmin
      .from('leads')
      .select('email, phone, company');

    const existingEmails = new Set(
      (existingLeads || [])
        .map((l) => (l.email || '').toLowerCase().trim())
        .filter(Boolean)
    );
    const existingPhones = new Set(
      (existingLeads || [])
        .map((l) => normalizePhoneNumber(l.phone))
        .filter(Boolean)
    );
    const existingCompanies = new Set(
      (existingLeads || [])
        .map((l) => (l.company || '').toLowerCase().trim())
        .filter(Boolean)
    );

    const seenInBatchEmails = new Set();
    const seenInBatchPhones = new Set();
    const seenInBatchCompanies = new Set();

    for (const row of rows) {
      const company = (
        row[columnMap.company] ||
        row.company_name ||
        row['Company Name'] ||
        row.Supplier ||
        row['Supplier name'] ||
        row.Company ||
        row.company ||
        ''
      ).trim();
      const firstName = (row[columnMap.first_name] || row.first_name || row['First Name'] || '').trim();
      const lastName = (row[columnMap.last_name] || row.last_name || row['Last Name'] || '').trim();
      const contactRoute = (row[columnMap.public_contact_route] || row['Public contact route'] || row.Contact || '').trim();
      let fullName = (row[columnMap.name] || row.full_name || row['Full Name'] || row.Name || row.name || `${firstName} ${lastName}`).trim();
      if (!fullName && contactRoute) {
        fullName = contactRoute.split(/[,;\n]/)[0].trim();
      }
      if (!fullName && company) {
        fullName = `${company} Commercial Desk`;
      }

      const email = (row[columnMap.email] || row.email || row.Email || '').trim().toLowerCase();
      const phone = (row[columnMap.phone] || row.phone || row.Phone || '').trim();
      const normalizedPhone = normalizePhoneNumber(phone);
      const normalizedCompany = company.toLowerCase().trim();
      const jobTitle = (row[columnMap.job_title] || row.Title || row.Position || row.role || row.job_title || 'Commercial / Sourcing Lead').trim();
      const website = (row[columnMap.website] || row.Website || row.website || '').trim();
      const supplierType = (row[columnMap.supplier_type] || row['Supplier type'] || row.Type || row.lead_type || row['Lead Type'] || 'Producer / Processor').trim();
      const industry = (row[columnMap.niche] || row[columnMap.industry] || row.Industry || row.industry || supplierType || 'Industrial Minerals').trim();
      
      const locationNote = (row[columnMap.location_note] || row['Location / origin note'] || row.Location || '').trim();
      let city = (row[columnMap.city] || row.city || row.City || '').trim();
      let country = (row[columnMap.country] || row.country || row.Country || '').trim();

      if (locationNote && (!country || !city)) {
        const parts = locationNote.split(/[\/,;-]/).map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          city = city || parts[0];
          country = country || parts[1];
        } else if (parts.length === 1) {
          country = country || parts[0];
        }
      }

      const priority = (row[columnMap.priority] || row.Priority || row.priority || 'A').trim().toUpperCase();
      const rank = (row[columnMap.rank] || row.Rank || row.lead_id || row.id || '').trim();
      const materials = (
        row[columnMap.materials] ||
        row.Materials ||
        row.materials ||
        row.product ||
        row.Product ||
        row.mineral ||
        row.Mineral ||
        ''
      ).trim();
      const productFit = (
        row[columnMap.product_fit] ||
        row['Product / application fit'] ||
        row.Application ||
        row.application ||
        row.applications ||
        row.Applications ||
        ''
      ).trim();
      const publicEvidence = (row[columnMap.evidence] || row['Public service evidence'] || row['Evidence basis'] || '').trim();
      const confirmBeforeBuying = (row[columnMap.confirm_before_buying] || row['Confirm before buying'] || '').trim();
      const sourceLinks = (
        row[columnMap.source_links] ||
        row['Source links'] ||
        [row.product_source_url, row.contact_source_url].filter(Boolean).join(', ') ||
        ''
      ).trim();
      const notes = (row[columnMap.notes] || row.notes || row.Notes || '').trim();
      const rowTags = row[columnMap.tags] ? row[columnMap.tags].split(',').map((t) => t.trim()).filter(Boolean) : [];

      if (!company && !fullName && !email && !phone) {
        invalidRows++;
        continue;
      }

      const isDuplicate =
        (email && (existingEmails.has(email) || seenInBatchEmails.has(email))) ||
        (normalizedPhone && (existingPhones.has(normalizedPhone) || seenInBatchPhones.has(normalizedPhone))) ||
        (!email && !normalizedPhone && normalizedCompany && (existingCompanies.has(normalizedCompany) || seenInBatchCompanies.has(normalizedCompany)));

      if (isDuplicate) {
        duplicateRows++;
        continue;
      }

      if (email) seenInBatchEmails.add(email);
      if (normalizedPhone) seenInBatchPhones.add(normalizedPhone);
      if (normalizedCompany) seenInBatchCompanies.add(normalizedCompany);

      const detectedCategory =
        materials ||
        (row['Bleaching earth'] ? 'Bleaching Earth' : null) ||
        (row.Bentonite ? 'Bentonite' : null) ||
        (row.Kaolin ? 'Kaolin' : null) ||
        (row['Calcium carbonate'] ? 'Calcium Carbonate' : null) ||
        'Industrial Minerals';

      const generatedTags = Array.from(
        new Set([
          ...defaultTags,
          ...rowTags,
          priority ? `Priority-${priority}` : null,
          materials ? materials.split(/[,;\/]/).map((m) => m.trim()) : null,
          row['Bleaching earth'] ? 'Bleaching Earth' : null,
          row.Bentonite ? 'Bentonite' : null,
          row.Kaolin ? 'Kaolin' : null,
          row['Calcium carbonate'] ? 'Calcium Carbonate' : null,
        ].flat().filter(Boolean))
      );

      leadsToScore.push({
        first_name: firstName || (fullName ? fullName.split(' ')[0] : 'Commercial'),
        last_name: lastName || (fullName && fullName.split(' ').length > 1 ? fullName.split(' ').slice(1).join(' ') : 'Lead'),
        full_name: fullName,
        email: email || null,
        phone: phone || '',
        company: company || fullName,
        job_title: jobTitle,
        website,
        industry,
        niche: industry,
        location: { city, country, timezone: 'UTC' },
        tags: generatedTags,
        status: 'NEW',
        pipeline_stage: 'NEW',
        assigned_to: assignedUserId,
        custom_fields: {
          priority,
          rank,
          supplier_type: supplierType,
          company_type: supplierType,
          materials: materials || detectedCategory,
          product_category: detectedCategory,
          application: productFit,
          product_fit: productFit,
          required_specifications: confirmBeforeBuying,
          confirm_before_buying: confirmBeforeBuying,
          public_contact_route: contactRoute,
          source_links: sourceLinks,
          evidence_basis: publicEvidence,
          country,
          city,
          notes,
          mineral_flags: {
            bentonite: row.Bentonite || row.bentonite || (detectedCategory.toLowerCase().includes('bentonite') ? 'Bentonite' : ''),
            kaolin: row.Kaolin || row.kaolin || (detectedCategory.toLowerCase().includes('kaolin') ? 'Kaolin' : ''),
            bleaching_earth: row['Bleaching earth'] || row.bleaching_earth || (detectedCategory.toLowerCase().includes('bleaching') ? 'Bleaching Earth' : ''),
            calcium_carbonate: row['Calcium carbonate'] || row.calcium_carbonate || (detectedCategory.toLowerCase().includes('calcium') ? 'Calcium Carbonate' : ''),
          },
          original_imported_data: row,
        },
        enrich_data: {
          rawEvidence: [publicEvidence, sourceLinks ? `Sources: ${sourceLinks}` : ''].filter(Boolean).join('\n'),
        },
        notes: notes || '',
      });

      validRows++;
    }

    // 2. Real-Time Scoring on Batch
    const scoredLeads = await scoreBatchWithClaude(leadsToScore);

    if (isPreview) {
      return NextResponse.json({
        success: true,
        preview: true,
        summary: {
          totalRows: rows.length,
          validRows,
          duplicateRows,
          invalidRows,
        },
        sample: scoredLeads.slice(0, 8),
      });
    }

    // 3. Insert Scored Leads into Supabase
    let importedCount = 0;
    if (scoredLeads.length > 0) {
      const recordsToInsert = scoredLeads.map((l) => ({
        first_name: l.first_name,
        last_name: l.last_name,
        full_name: l.full_name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        job_title: l.job_title,
        website: l.website,
        industry: l.industry,
        niche: l.niche,
        location: l.location,
        tags: l.tags,
        status: 'NEW',
        pipeline_stage: 'NEW',
        assigned_to: l.assigned_to,
        score: l.score || l.scoring?.compositeScore || 75,
        custom_fields: {
          ...(l.custom_fields || {}),
          scoring: l.scoring || {
            fitScore: l.score || 80,
            intentScore: 75,
            engagementScore: 70,
            compositeScore: l.score || 78,
          },
        },
        enrich_data: l.enrich_data || {},
        notes: l.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: insertedData, error: insertErr } = await supabaseAdmin
        .from('leads')
        .insert(recordsToInsert)
        .select('id, full_name, company, score');

      if (insertErr) {
        console.error('[CSV Import Supabase Insert Error]:', insertErr);
        throw new Error(`Database error saving leads: ${insertErr.message}`);
      }

      importedCount = insertedData ? insertedData.length : recordsToInsert.length;

      // 4. Record Real-Time Activity Log in Supabase
      await supabaseAdmin
        .from('activity_logs')
        .insert({
          user_id: assignedUserId,
          type: 'LEADS_CSV_IMPORTED',
          description: `Imported and AI-scored ${importedCount} leads via CSV. High-priority queue updated.`,
          metadata: {
            totalRows: rows.length,
            imported: importedCount,
            duplicates: duplicateRows,
            invalidRows,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: `Import complete. ${importedCount} leads added and AI-scored.`,
      data: {
        totalRows: rows.length,
        imported: importedCount,
        duplicates: duplicateRows,
        invalidRows,
      },
    });
  } catch (err) {
    console.error('[CSV Import] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
