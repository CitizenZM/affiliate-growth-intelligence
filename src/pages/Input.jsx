import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Upload, ChevronRight, ChevronLeft, Loader2, FileSpreadsheet, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import FilePreview from "../components/input/FilePreview";
import FieldMapper from "../components/input/FieldMapper";
import DataCleaning from "../components/input/DataCleaning";
import HistoryPanel from "../components/input/HistoryPanel";
import { syncDatasetRun } from "@/lib/supabasePipelineService";

const STEPS = ["上传文件", "预览&映射", "数据清洗", "补充信息"];

export default function InputPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Parsed data
  const [parsedData, setParsedData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [fileType, setFileType] = useState("");
  
  // Field mapping
  const [fieldMapping, setFieldMapping] = useState({});
  
  // Data cleaning
  const [cleaningOptions, setCleaningOptions] = useState({
    removeDuplicates: true,
    handleMissing: true,
    missingNumeric: "zero",
    missingText: "unknown",
    filterLowGMV: false,
    minGMV: 0,
  });
  
  // Form data
  const [formData, setFormData] = useState({
    websiteUrl: "",
    webEnabled: false,
    platform: "",
    commission_model: "",
    market: "",
    cookie_window: "",
    version_label: "",
  });

  const parseFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    setFileType(ext);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let data = [];
          let headers = [];
          
          if (ext === 'csv') {
            const text = e.target.result;
            const lines = text.trim().split('\n');
            headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
              const row = {};
              headers.forEach((h, idx) => {
                row[h] = values[idx] || null;
              });
              data.push(row);
            }
          } else if (ext === 'xlsx' || ext === 'xls') {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            headers = jsonData[0].map(h => String(h).trim());
            for (let i = 1; i < jsonData.length; i++) {
              if (!jsonData[i].some(v => v)) continue;
              const row = {};
              headers.forEach((h, idx) => {
                row[h] = jsonData[i][idx] != null ? String(jsonData[i][idx]) : null;
              });
              data.push(row);
            }
          } else if (ext === 'json') {
            const json = JSON.parse(e.target.result);
            data = Array.isArray(json) ? json : [json];
            if (data.length > 0) {
              headers = Object.keys(data[0]);
            }
          }
          
          resolve({ data, headers });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      
      if (ext === 'csv' || ext === 'json') {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    setFile(f);
    setUploading(true);

    try {
      // Parse file
      const { data, headers: parsedHeaders } = await parseFile(f);
      setParsedData(data);
      setHeaders(parsedHeaders);
      
      // Auto-detect field mapping
      const autoMapping = {};
      const knownFields = {
        'publisher_id': ['publisher_id', 'publisherid', 'pub_id', 'id'],
        'publisher_name': ['publisher_name', 'publishername', 'name', 'publisher'],
        'total_revenue': ['total_revenue', 'revenue', 'gmv', 'total_gmv', 'sales'],
        'total_commission': ['total_commission', 'commission', 'payout'],
        'clicks': ['clicks', 'num_clicks', 'click_count'],
        'orders': ['orders', 'num_orders', 'transactions', 'conversions'],
        'approved_revenue': ['approved_revenue', 'approved', 'approved_sales'],
        'pending_revenue': ['pending_revenue', 'pending'],
        'declined_revenue': ['declined_revenue', 'declined', 'reversed_revenue'],
        'publisher_type': ['publisher_type', 'type', 'category', 'publisher_category'],
      };
      
      for (const header of parsedHeaders) {
        for (const [targetField, possibleNames] of Object.entries(knownFields)) {
          if (possibleNames.includes(header.toLowerCase())) {
            autoMapping[header] = targetField;
            break;
          }
        }
      }
      setFieldMapping(autoMapping);
      
      // Upload file
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setUploadResult({ file_url, file_name: f.name, local_only: false });
      } catch (uploadError) {
        // Fallback: continue with locally parsed rows even if remote upload is unavailable.
        console.warn("UploadFile failed, fallback to local parsed data:", uploadError);
        setUploadResult({ file_url: null, file_name: f.name, local_only: true });
      }
      
      // Auto advance to preview
      setStep(1);
    } catch (error) {
      console.error('File parsing error:', error);
      alert('文件解析失败：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    
    const fakeEvent = { target: { files: [f] } };
    await handleFileChange(fakeEvent);
  };

  const handleFieldMappingChange = (sourceField, targetField) => {
    setFieldMapping(prev => ({
      ...prev,
      [sourceField]: targetField,
    }));
  };

  const handleReuseConfig = (historyItem) => {
    setFormData({
      websiteUrl: historyItem.website_url || "",
      webEnabled: false,
      platform: historyItem.platform || "",
      commission_model: historyItem.commission_model || "",
      market: historyItem.market || "",
      cookie_window: historyItem.cookie_window?.toString() || "",
      version_label: "",
    });
    
    if (historyItem.field_mapping) {
      setFieldMapping(historyItem.field_mapping);
    }
    
    // Switch to upload tab
    setActiveTab("upload");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dataset = await base44.entities.DataUpload.create({
        file_url: uploadResult?.file_url || undefined,
        file_name: uploadResult?.file_name,
        website_url: formData.websiteUrl || undefined,
        platform: formData.platform || undefined,
        commission_model: formData.commission_model || undefined,
        market: formData.market || undefined,
        cookie_window: formData.cookie_window ? Number(formData.cookie_window) : undefined,
        version_label: formData.version_label || `v${new Date().toISOString().split('T')[0]}`,
        field_mapping: fieldMapping,
        status: "processing",
      });

      syncDatasetRun(dataset).catch(() => {});

      // Scrape website if enabled (don't wait)
      if (formData.webEnabled && formData.websiteUrl) {
        base44.functions.invoke('scrapeWebsite', {
          website_url: formData.websiteUrl,
          dataset_id: dataset.id,
        }).catch(error => {
          console.error('Website scraping error:', error);
        });
      }

      // Trigger processing (don't wait, let it run in background)
      base44.functions.invoke('processDataset', {
        dataset_id: dataset.id,
        file_url: uploadResult?.file_url,
        parsed_rows: parsedData || undefined,
        parsed_headers: headers || undefined,
        field_mapping: fieldMapping,
        cleaning_options: cleaningOptions,
      });

      return dataset;
    },
    onSuccess: () => {
      setTimeout(() => {
        setStep(0);
        setFile(null);
        setUploadResult(null);
        setParsedData(null);
        setHeaders([]);
        setFieldMapping({});
        setFormData({});
      }, 2000);
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">数据接入</h1>
        <p className="text-sm text-slate-500 mt-1">智能解析、字段映射、数据清洗一站式流程</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upload" className="text-xs">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            新上传
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="w-3.5 h-3.5 mr-1.5" />
            历史记录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <HistoryPanel onReuse={handleReuseConfig} />
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={i}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                    ${i === step ? "bg-blue-600 text-white" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                >
                  <span className="w-4 text-center">{i + 1}</span>
                  <span>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-slate-800">上传数据文件</h2>
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                      uploading ? "border-blue-300 bg-blue-50/30" : uploadResult ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                        <p className="text-sm text-slate-600">正在解析文件...</p>
                      </div>
                    ) : uploadResult ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                        <p className="text-sm font-medium text-slate-700">{uploadResult.file_name}</p>
                        <p className="text-xs text-emerald-600">✓ 已解析 {parsedData?.length || 0} 行数据</p>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-3">
                        <Upload className="w-10 h-10 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">拖拽文件到此处，或点击上传</p>
                          <p className="text-xs text-slate-400 mt-1">支持 CSV / Excel / JSON 格式</p>
                        </div>
                        <input 
                          type="file" 
                          accept=".csv,.xlsx,.xls,.json" 
                          className="hidden" 
                          onChange={handleFileChange} 
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {step === 1 && parsedData && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                  <FilePreview data={parsedData} headers={headers} fileType={fileType} />
                  <FieldMapper 
                    headers={headers} 
                    mapping={fieldMapping} 
                    onChange={handleFieldMappingChange} 
                  />
                </div>
              )}

              {step === 2 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <DataCleaning options={cleaningOptions} onChange={setCleaningOptions} />
                </div>
              )}

              {step === 3 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-slate-800">补充信息</h2>
                  
                  {/* Website scraping section */}
                  <div className="space-y-3 pb-4 border-b border-slate-200">
                    <div>
                      <Label className="text-sm text-slate-600">品牌官网 URL</Label>
                      <Input 
                        placeholder="https://www.example.com" 
                        className="mt-1.5" 
                        value={formData.websiteUrl} 
                        onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} 
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">联网抓取开关</p>
                        <p className="text-xs text-slate-400 mt-0.5">开启后将抓取价格带、促销机制、信任组件等信息</p>
                      </div>
                      <Switch 
                        checked={formData.webEnabled} 
                        onCheckedChange={(v) => setFormData({ ...formData, webEnabled: v })} 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-600">数据版本标签</Label>
                      <Input 
                        placeholder="如 2026-02 或 Q1-2026" 
                        className="mt-1.5" 
                        value={formData.version_label} 
                        onChange={(e) => setFormData({ ...formData, version_label: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-600">平台</Label>
                      <Select value={formData.platform} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="选择平台" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Impact">Impact</SelectItem>
                          <SelectItem value="CJ">CJ</SelectItem>
                          <SelectItem value="Awin">Awin</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-slate-600">佣金模式</Label>
                      <Select value={formData.commission_model} onValueChange={(v) => setFormData({ ...formData, commission_model: v })}>
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="选择模式" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CPS">CPS</SelectItem>
                          <SelectItem value="CPA">CPA</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-slate-600">市场</Label>
                      <Input placeholder="如 US, UK, Global" className="mt-1.5" value={formData.market} onChange={(e) => setFormData({ ...formData, market: e.target.value })} />
                    </div>
                  </div>

                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !uploadResult}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    提交并开始分析
                  </Button>
                  
                  {saveMutation.isSuccess && (
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <p className="text-sm text-emerald-700 font-medium">✓ 已提交，系统正在后台处理</p>
                      <p className="text-xs text-emerald-600 mt-1">处理流程：解析 → 清洗 → 计算指标 → AI 生成分析</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setStep(Math.max(0, step - 1))} 
              disabled={step === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> 上一步
            </Button>
            {step < 3 && (
              <Button 
                size="sm" 
                onClick={() => setStep(step + 1)} 
                disabled={step === 0 && !uploadResult}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                下一步 <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
