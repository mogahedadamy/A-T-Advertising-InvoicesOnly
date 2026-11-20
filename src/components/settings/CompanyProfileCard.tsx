import React, { useState } from "react";
import { Mail, Phone, MapPin, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCompanyProfile } from "@/lib/settings/companyProfileStore";

export const CompanyProfileCard: React.FC = () => {
  const { email, phone, addressAr, addressEn, updateCompanyProfile } = useCompanyProfile();

  const [formEmail, setFormEmail] = useState(email);
  const [formPhone, setFormPhone] = useState(phone);
  const [formAddrAr, setFormAddrAr] = useState(addressAr);
  const [formAddrEn, setFormAddrEn] = useState(addressEn);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when store values change
  React.useEffect(() => {
    setFormEmail(email);
    setFormPhone(phone);
    setFormAddrAr(addressAr);
    setFormAddrEn(addressEn);
  }, [email, phone, addressAr, addressEn]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateCompanyProfile({
        email: formEmail,
        phone: formPhone,
        addressAr: formAddrAr,
        addressEn: formAddrEn,
      });
      toast.success("تم حفظ بيانات الفاتورة بنجاح", {
        description: "سيتم تطبيق البريد الإلكتروني والبيانات المحدثة فوراً على كل الفواتير.",
      });
    } catch {
      toast.error("تعذر الحفظ", {
        description: "حدث خطأ أثناء حفظ الإعدادات.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-base text-foreground">بيانات الشركة في الفاتورة</h3>
          <p className="text-xs text-muted-foreground">
            تخصيص البريد الإلكتروني، الهواتف، والعنوان الظاهر في ترويسة الفواتير المطبوعة.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3 pt-1">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            البريد الإلكتروني الرسمي (Company Email)
          </label>
          <div className="relative">
            <Input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="t.a.advertising@gmail.com"
              className="text-left font-mono text-sm pl-9"
              dir="ltr"
              required
            />
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            أرقام الهواتف (Phone Numbers)
          </label>
          <div className="relative">
            <Input
              type="text"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="+249 12371 1444 - +249 91296 8886"
              className="text-left font-mono text-sm pl-9"
              dir="ltr"
              style={{ direction: "ltr", unicodeBidi: "isolate" }}
            />
            <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              العنوان بالعربية
            </label>
            <Input
              type="text"
              value={formAddrAr}
              onChange={(e) => setFormAddrAr(e.target.value)}
              placeholder="السودان، الخرطوم - بورتسودان"
              className="text-xs"
              dir="rtl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              العنوان بالإنجليزية
            </label>
            <Input
              type="text"
              value={formAddrEn}
              onChange={(e) => setFormAddrEn(e.target.value)}
              placeholder="Sudan, Khartoum - Portsudan"
              className="text-xs"
              dir="ltr"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="submit" disabled={isSaving} size="sm" className="gap-2">
            {isSaving ? (
              <span>جاري الحفظ...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ بيانات الفاتورة</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

