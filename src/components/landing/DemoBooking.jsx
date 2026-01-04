import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle, Mail, User, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function DemoBooking() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    school: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      toast.success('Demo request submitted! We\'ll be in touch within 24 hours.');
      
      // Reset after showing success
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({ name: '', email: '', school: '', message: '' });
      }, 3000);
    }, 1000);
  };

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
              Book a Demo
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-6">
              See Schedual Live in Action
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Schedule a personalized demo with our team. We'll walk you through the platform, answer your questions, and show you how Schedual can transform your school's scheduling process.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: Calendar,
                  title: '30-Minute Demo',
                  description: 'Personalized walkthrough of Schedual's features tailored to your school's needs.',
                  color: 'from-blue-500 to-blue-600'
                },
                {
                  icon: Clock,
                  title: 'Flexible Scheduling',
                  description: 'Choose a time that works for you. We accommodate all time zones.',
                  color: 'from-purple-500 to-purple-600'
                },
                {
                  icon: CheckCircle,
                  title: 'No Commitment',
                  description: 'Free demo with no obligation. See if Schedual is right for your school.',
                  color: 'from-emerald-500 to-emerald-600'
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex gap-4"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 shadow-2xl p-8">
              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted!</h3>
                  <p className="text-slate-600">We'll contact you within 24 hours to schedule your demo.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      Full Name *
                    </label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email Address *
                    </label>
                    <Input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@school.edu"
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      <Building2 className="w-4 h-4 inline mr-2" />
                      School Name *
                    </label>
                    <Input
                      required
                      value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                      placeholder="International Baccalaureate School"
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Message (Optional)
                    </label>
                    <Textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your scheduling needs..."
                      rows={4}
                      className="bg-white"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6"
                  >
                    {isSubmitting ? 'Submitting...' : 'Request Free Demo'}
                  </Button>

                  <p className="text-xs text-center text-slate-500">
                    By submitting, you agree to our Terms of Service and Privacy Policy
                  </p>
                </form>
              )}
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -z-10"></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}