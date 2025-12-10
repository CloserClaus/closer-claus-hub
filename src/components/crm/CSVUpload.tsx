import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Check, AlertCircle, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CSVUploadProps {
  workspaceId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  [csvColumn: string]: string;
}

const LEAD_FIELDS = [
  { value: 'first_name', label: 'First Name', required: true },
  { value: 'last_name', label: 'Last Name', required: true },
  { value: 'email', label: 'Email', required: false },
  { value: 'phone', label: 'Phone', required: false },
  { value: 'company', label: 'Company', required: false },
  { value: 'title', label: 'Job Title', required: false },
  { value: 'notes', label: 'Notes', required: false },
  { value: '_skip', label: 'Skip this column', required: false },
];

export function CSVUpload({ workspaceId, onSuccess, onCancel }: CSVUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [duplicates, setDuplicates] = useState<{ index: number; reason: string }[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const parseCSV = useCallback((content: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header row
    const headerLine = lines[0];
    const parsedHeaders = parseCSVLine(headerLine);

    // Parse data rows
    const parsedRows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === parsedHeaders.length) {
        const row: ParsedRow = {};
        parsedHeaders.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });
        parsedRows.push(row);
      }
    }

    return { headers: parsedHeaders, rows: parsedRows };
  }, []);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  const autoMapColumns = (csvHeaders: string[]) => {
    const mapping: ColumnMapping = {};
    const fieldMappings: { [key: string]: string[] } = {
      first_name: ['first_name', 'firstname', 'first name', 'given name', 'givenname', 'fname'],
      last_name: ['last_name', 'lastname', 'last name', 'surname', 'family name', 'familyname', 'lname'],
      email: ['email', 'e-mail', 'email address', 'emailaddress'],
      phone: ['phone', 'telephone', 'phone number', 'phonenumber', 'mobile', 'cell', 'tel'],
      company: ['company', 'company name', 'companyname', 'organization', 'organisation', 'org'],
      title: ['title', 'job title', 'jobtitle', 'position', 'role'],
      notes: ['notes', 'note', 'comments', 'comment', 'description'],
    };

    csvHeaders.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(fieldMappings)) {
        if (aliases.includes(normalizedHeader)) {
          mapping[header] = field;
          break;
        }
      }
      if (!mapping[header]) {
        mapping[header] = '_skip';
      }
    });

    return mapping;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    try {
      const content = await selectedFile.text();
      const { headers: parsedHeaders, rows: parsedRows } = parseCSV(content);

      if (parsedRows.length === 0) {
        toast.error('CSV file contains no data rows');
        return;
      }

      if (parsedRows.length > 1000) {
        toast.error('Maximum 1000 leads can be uploaded at once');
        return;
      }

      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setColumnMapping(autoMapColumns(parsedHeaders));
      setStep('mapping');
    } catch (error) {
      toast.error('Failed to parse CSV file. Please check the format.');
      console.error('CSV parse error:', error);
    }
  };

  const handleMappingChange = (csvColumn: string, leadField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: leadField,
    }));
  };

  const validateMapping = (): boolean => {
    const mappedFields = Object.values(columnMapping);
    const hasFirstName = mappedFields.includes('first_name');
    const hasLastName = mappedFields.includes('last_name');

    const newErrors: string[] = [];
    if (!hasFirstName) {
      newErrors.push('First Name is required');
    }
    if (!hasLastName) {
      newErrors.push('Last Name is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const checkForDuplicates = async (leads: ReturnType<typeof transformRowToLead>[]) => {
    setIsCheckingDuplicates(true);
    const foundDuplicates: { index: number; reason: string }[] = [];

    try {
      // Fetch existing leads for this workspace
      const { data: existingLeads, error } = await supabase
        .from('leads')
        .select('email, first_name, last_name, company')
        .eq('workspace_id', workspaceId);

      if (error) {
        console.error('Error fetching existing leads:', error);
        return [];
      }

      // Create lookup sets for fast duplicate detection
      const existingEmails = new Set(
        existingLeads?.filter(l => l.email).map(l => l.email!.toLowerCase()) || []
      );
      const existingNameCompanyCombos = new Set(
        existingLeads?.map(l => 
          `${l.first_name?.toLowerCase()}-${l.last_name?.toLowerCase()}-${l.company?.toLowerCase() || ''}`
        ) || []
      );

      // Also track duplicates within the CSV itself
      const csvEmails = new Set<string>();
      const csvNameCompanyCombos = new Set<string>();

      leads.forEach((lead, index) => {
        const email = lead.email?.toLowerCase();
        const nameCombo = `${lead.first_name.toLowerCase()}-${lead.last_name.toLowerCase()}-${lead.company?.toLowerCase() || ''}`;

        // Check email duplicates (most reliable)
        if (email) {
          if (existingEmails.has(email)) {
            foundDuplicates.push({ index, reason: `Email "${lead.email}" already exists` });
            return;
          }
          if (csvEmails.has(email)) {
            foundDuplicates.push({ index, reason: `Duplicate email "${lead.email}" in CSV` });
            return;
          }
          csvEmails.add(email);
        }

        // Check name+company duplicates if no email
        if (!email) {
          if (existingNameCompanyCombos.has(nameCombo)) {
            foundDuplicates.push({ 
              index, 
              reason: `"${lead.first_name} ${lead.last_name}"${lead.company ? ` at ${lead.company}` : ''} already exists` 
            });
            return;
          }
          if (csvNameCompanyCombos.has(nameCombo)) {
            foundDuplicates.push({ 
              index, 
              reason: `Duplicate "${lead.first_name} ${lead.last_name}"${lead.company ? ` at ${lead.company}` : ''} in CSV` 
            });
            return;
          }
          csvNameCompanyCombos.add(nameCombo);
        }
      });
    } catch (error) {
      console.error('Duplicate check error:', error);
    } finally {
      setIsCheckingDuplicates(false);
    }

    return foundDuplicates;
  };

  const handleProceedToPreview = async () => {
    if (validateMapping()) {
      const leads = rows.map(transformRowToLead);
      const validLeads = leads.filter(lead => lead.first_name && lead.last_name);
      const foundDuplicates = await checkForDuplicates(validLeads);
      setDuplicates(foundDuplicates);
      setStep('preview');
    }
  };

  const transformRowToLead = (row: ParsedRow) => {
    const lead: {
      workspace_id: string;
      created_by: string;
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      company?: string;
      title?: string;
      notes?: string;
    } = {
      workspace_id: workspaceId,
      created_by: user!.id,
      first_name: '',
      last_name: '',
    };

    Object.entries(columnMapping).forEach(([csvColumn, leadField]) => {
      if (leadField !== '_skip' && row[csvColumn]) {
        (lead as any)[leadField] = row[csvColumn].trim();
      }
    });

    return lead;
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error('Please log in to upload leads');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrors([]);

    try {
      const leads = rows.map(transformRowToLead);
      let validLeads = leads.filter(lead => lead.first_name && lead.last_name);
      const invalidCount = leads.length - validLeads.length;

      // Filter out duplicates if skip is enabled
      if (skipDuplicates && duplicates.length > 0) {
        const duplicateIndices = new Set(duplicates.map(d => d.index));
        validLeads = validLeads.filter((_, index) => !duplicateIndices.has(index));
      }

      if (validLeads.length === 0) {
        toast.error('No valid leads to upload (all are duplicates or invalid)');
        setIsUploading(false);
        return;
      }

      // Upload in batches of 50
      const batchSize = 50;
      let uploadedCount = 0;
      const failedRows: number[] = [];

      for (let i = 0; i < validLeads.length; i += batchSize) {
        const batch = validLeads.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('leads')
          .insert(batch);

        if (error) {
          console.error('Batch insert error:', error);
          for (let j = i; j < i + batch.length; j++) {
            failedRows.push(j + 1);
          }
        } else {
          uploadedCount += batch.length;
        }

        setUploadProgress(Math.round(((i + batch.length) / validLeads.length) * 100));
      }

      if (failedRows.length > 0) {
        setErrors([`Failed to upload ${failedRows.length} leads`]);
        toast.error(`Uploaded ${uploadedCount} leads, ${failedRows.length} failed`);
      } else {
        toast.success(`Successfully uploaded ${uploadedCount} leads${invalidCount > 0 ? ` (${invalidCount} skipped due to missing required fields)` : ''}`);
        setStep('complete');
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload leads');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'First Name,Last Name,Email,Phone,Company,Job Title,Notes\nJohn,Doe,john@example.com,+1234567890,Acme Corp,Sales Manager,Interested in our product\nJane,Smith,jane@example.com,+0987654321,Tech Inc,CTO,Follow up next week';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewLeads = rows.slice(0, 5).map(transformRowToLead);

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload CSV File</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Click to browse or drag and drop your CSV file here
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum 1000 leads, 5MB file size
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <Button variant="ghost" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{file?.name}</p>
              <p className="text-sm text-muted-foreground">{rows.length} rows found</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFile(null);
                setHeaders([]);
                setRows([]);
                setStep('upload');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Map Columns</CardTitle>
              <CardDescription>
                Match your CSV columns to lead fields. First Name and Last Name are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {headers.map(header => (
                <div key={header} className="flex items-center gap-4">
                  <span className="w-1/3 text-sm font-medium truncate" title={header}>
                    {header}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={columnMapping[header] || '_skip'}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger className="w-2/3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FIELDS.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {errors.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-destructive mb-1">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Validation Errors</span>
              </div>
              <ul className="text-sm text-destructive/80 list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button onClick={handleProceedToPreview} disabled={isCheckingDuplicates}>
              {isCheckingDuplicates ? 'Checking duplicates...' : 'Continue to Preview'}
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Preview</h3>
              <p className="text-sm text-muted-foreground">
                Showing first 5 of {rows.length} leads
              </p>
            </div>
            <div className="flex items-center gap-2">
              {duplicates.length > 0 && (
                <Badge variant="outline" className="text-warning border-warning/20">
                  {duplicates.length} duplicates
                </Badge>
              )}
              <Badge variant="outline" className="text-success border-success/20">
                {skipDuplicates ? rows.length - duplicates.length : rows.length} leads ready
              </Badge>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{duplicates.length} Duplicate Leads Detected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="skip-duplicates"
                    checked={skipDuplicates}
                    onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
                  />
                  <label htmlFor="skip-duplicates" className="text-sm cursor-pointer">
                    Skip duplicates
                  </label>
                </div>
              </div>
              <ScrollArea className="max-h-24">
                <ul className="text-sm text-muted-foreground space-y-1">
                  {duplicates.slice(0, 5).map((dup, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="text-muted-foreground/60">Row {dup.index + 2}:</span> {dup.reason}
                    </li>
                  ))}
                  {duplicates.length > 5 && (
                    <li className="text-muted-foreground/60">...and {duplicates.length - 5} more</li>
                  )}
                </ul>
              </ScrollArea>
            </div>
          )}

          <ScrollArea className="h-64 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewLeads.map((lead, index) => (
                  <TableRow key={index}>
                    <TableCell>{lead.first_name || '-'}</TableCell>
                    <TableCell>{lead.last_name || '-'}</TableCell>
                    <TableCell>{lead.email || '-'}</TableCell>
                    <TableCell>{lead.phone || '-'}</TableCell>
                    <TableCell>{lead.company || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading leads...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep('mapping')} disabled={isUploading}>
              Back
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? 'Uploading...' : `Upload ${rows.length} Leads`}
            </Button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center py-8">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h3 className="text-lg font-medium mb-2">Upload Complete!</h3>
          <p className="text-muted-foreground">
            Your leads have been successfully imported.
          </p>
        </div>
      )}
    </div>
  );
}
