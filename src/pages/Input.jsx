import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, Globe, ChevronRight, ChevronLeft, CheckCircle2, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = ["上传与识别", "官网与联网", "补充信息"];

export default function InputPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [webEnabled, setWebEnabled] = useState(false);
  const [formData, setFormData] = useState({
    platform: "",
    commission_model: "",
    market: "",
    cookie_window: "",
  });

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setUploading(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    setUploadResult({ file_url, file_name: f.name });
    setUploading(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    setUploadResult({ file_url, file_name: f.name });
    setUploading(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Create dataset
      const dataset = await base44.entities.DataUpload.create({
        file_url: uploadResult?.file_url,
        file_name: uploadResult?.file_name,
        website_url: websiteUrl,
        platform: formData.platform || undefined,
        commission_model: formData.commission_model || undefined,
        market: formData.market || undefined,
        cookie_window: formData.cookie_window ? Number(formData.cookie_window) : undefined,
        version_label: formData.version_label || `v${new Date().toISOString().split('T')[0]}`,
        status: "processing",
      });

      // Trigger processing pipeline (async - don't wait)
      base44.functions.invoke('processDataset', {
        dataset_id: dataset.id,
        file_url: uploadResult?.file_url,
      }).catch(error => {
        console.error('Processing error:', error);
      });

      return dataset;
    },
    onSuccess: () => {
      // Reset form after 2 seconds
      setTimeout(() => {
        setStep(1);
        setUploadResult(null);
        setWebsiteUrl("");
        setFormData({});
      }, 2000);
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">数据接入</h1>
        <p className="text-sm text-slate-500 mt-1">三步导入向导：上传数据 → 配置联网 → 补充信息</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                ${i === step ? "bg-blue-600 text-white" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              onClick={() => i < step && setStep(i)}
            >
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200" />}
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
              <h2 className="text-lg font-semibold text-slate-800">Step 1: 上传数据文件</h2>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  uploading ? "border-blue-300 bg-blue-50/30" : file ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-600">正在上传...</p>
                  </div>
                ) : uploadResult ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-medium text-slate-700">{uploadResult.file_name}</p>
                    <p className="text-xs text-emerald-600">上传成功 ✓</p>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">拖拽文件到此处，或点击上传</p>
                      <p className="text-xs text-slate-400 mt-1">支持 CSV / Excel 格式</p>
                    </div>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>
              {uploadResult && (
                <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-xs text-blue-700">文件已上传，系统将自动识别字段。进入下一步继续配置。</p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-800">Step 2: 官网链接与联网</h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-slate-600">品牌官网 URL</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="https://www.example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-700">联网抓取开关</p>
                    <p className="text-xs text-slate-400 mt-0.5">开启后将抓取价格带、促销机制、信任组件等信息</p>
                  </div>
                  <Switch checked={webEnabled} onCheckedChange={setWebEnabled} />
                </div>
                {webEnabled && (
                  <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                    <p className="text-xs text-amber-700">联网功能将抓取公开网页信息用于分析，结果将以可编辑卡片展示</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-800">Step 3: 补充信息 (可选)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div>
                  <Label className="text-sm text-slate-600">Cookie 窗口 (天)</Label>
                  <Input type="number" placeholder="30" className="mt-1.5" value={formData.cookie_window} onChange={(e) => setFormData({ ...formData, cookie_window: e.target.value })} />
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">当前数据覆盖情况</p>
                <div className="grid grid-cols-3 gap-2">
                  {["激活漏斗", "集中度", "结构健康", "效率象限", "交易质量"].map((m) => (
                    <div key={m} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span className="text-slate-600">{m}</span>
                    </div>
                  ))}
                  {["Daily GMV 趋势", "甘特图"].map((m) => (
                    <div key={m} className="flex items-center gap-1.5 text-xs">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      <span className="text-slate-400">{m} (需补充)</span>
                    </div>
                  ))}
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
                  <p className="text-xs text-emerald-600 mt-1">处理流程：解析 CSV → 计算指标 → AI 生成分析</p>
                  <p className="text-xs text-emerald-600">完成后可在各模块页面查看结果</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> 上一步
        </Button>
        {step < 2 && (
          <Button size="sm" onClick={() => setStep(step + 1)} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
            下一步 <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}