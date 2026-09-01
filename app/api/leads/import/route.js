import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import ActivityLog from '@/lib/models/ActivityLog';
import { mapCsvHeaders } from '@/lib/services/leadService';
import csv from 'csv-parser';
import { Readable } from 'stream';

export async function POST(request) {
  try {
    await connectToDatabase();

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

    let imported = 0;
    let duplicates = 0;
    let missingContact = 0;

    for (const row of rows) {
      const name = (row[columnMap.name] || `${row[columnMap.first_name] || ''} ${row[columnMap.last_name] || ''}`).trim();
      const email = (row[columnMap.email] || '').trim().toLowerCase();
      const phone = (row[columnMap.phone] || '').trim();
      const company = (row[columnMap.company] || '').trim();
      const jobTitle = (row[columnMap.job_title] || '').trim();
      const website = (row[columnMap.website] || '').trim();
      const niche = (row[columnMap.niche] || '').trim();
      const city = (row[columnMap.city] || '').trim();
      const country = (row[columnMap.country] || '').trim();
      const rowTags = row[columnMap.tags] ? row[columnMap.tags].split(',').map((t) => t.trim()) : [];

      if (!name && !email && !phone) {
        missingContact++;
        continue;
      }

      // Check duplicates
      if (email) {
        const existing = await Lead.findOne({ email });
        if (existing) {
          duplicates++;
          continue;
        }
      }

      const lead = await Lead.create({
        firstName: row[columnMap.first_name] || (name ? name.split(' ')[0] : ''),
        lastName: row[columnMap.last_name] || (name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : ''),
        fullName: name || email || phone,
        email,
        phone,
        company,
        jobTitle,
        website,
        niche,
        location: { city, country, timezone: 'UTC' },
        tags: Array.from(new Set([...defaultTags, ...rowTags])),
        status: 'NEW',
        source: 'csv_import',
      });

      await ActivityLog.create({
        leadId: lead._id,
        action: 'LEAD_CREATED',
        channel: 'system',
        direction: 'system',
        summary: `Imported via CSV: ${lead.fullName || lead.email}`,
        timestamp: new Date(),
      });

      imported++;
    }

    return NextResponse.json({
      success: true,
      message: `Import complete. ${imported} leads added.`,
      data: {
        totalRows: rows.length,
        imported,
        duplicates,
        missingContact,
      },
    });
  } catch (err) {
    console.error('[CSV Import] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
