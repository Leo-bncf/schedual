import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { CheckCircle, Circle, BookOpen, Users, GraduationCap, Building2, Calendar, ArrowRight, Settings, Upload, Sparkles, Zap } from 'lucide-react';

export default function Onboarding() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools', user?.school_id],
    queryFn: () => base44.entities.School.filter({ id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', user?.school_id],
    queryFn: () => base44.entities.Subject.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', user?.school_id],
    queryFn: () => base44.entities.Teacher.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', user?.school_id],
    queryFn: () => base44.entities.Student.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', user?.school_id],
    queryFn: () => base44.entities.Room.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', user?.school_id],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: classGroups = [] } = useQuery({
    queryKey: ['classGroups', user?.school_id],
    queryFn: () => base44.entities.ClassGroup.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const steps = [
    {
      id: 'school',
      title: 'School Settings',
      description: 'Configure your school details and schedule parameters',
      instructions: 'Set your school name, academic year, periods per day (typically 12), and other schedule settings.',
      quickTips: [
        'Click "Settings" to configure school-wide parameters',
        'Set periods per day, school start time, and days per week'
      ],
      page: 'Settings',
      icon: Settings,
      completed: schools.length > 0,
      count: schools.length
    },
    {
      id: 'subjects',
      title: 'Add Subjects',
      description: 'Create IB subjects across all groups (need at least 6)',
      instructions: 'Add subjects for each IB programme (PYP, MYP, DP). For DP, assign subjects to IB groups (1-6) and set HL/SL hours.',
      quickTips: [
        '💡 Use "Import Document" to bulk upload subjects from Excel/PDF',
        'Assign subjects to IB groups for proper scheduling',
        'Set hours per week for HL (6) and SL (4) subjects'
      ],
      page: 'Subjects',
      icon: BookOpen,
      completed: subjects.length >= 6,
      count: subjects.length,
      required: 6
    },
    {
      id: 'teachers',
      title: 'Add Teachers',
      description: 'Add teachers with their IB qualifications (need at least 3)',
      instructions: 'Add teachers and specify which subjects and IB levels (PYP, MYP, DP) they can teach.',
      quickTips: [
        '💡 Use "Import Document" to add multiple teachers at once',
        'Set qualifications to match teachers with subjects',
        'Configure max hours per week and unavailable time slots'
      ],
      page: 'Teachers',
      icon: Users,
      completed: teachers.length >= 3,
      count: teachers.length,
      required: 3
    },
    {
      id: 'students',
      title: 'Add Students',
      description: 'Add students with their programme and subject choices (need at least 5)',
      instructions: 'Add students and assign them to year groups. For DP students, select 6 subjects (3-4 HL, 2-3 SL).',
      quickTips: [
        '💡 Use "Import Document" to bulk import student data',
        'For DP: Choose 6 subjects covering 5-6 IB groups',
        'Assign students to class groups for PYP/MYP programmes'
      ],
      page: 'Students',
      icon: GraduationCap,
      completed: students.length >= 5,
      count: students.length,
      required: 5
    },
    {
      id: 'rooms',
      title: 'Add Rooms',
      description: 'Configure classrooms and specialized spaces (need at least 5)',
      instructions: 'Add classrooms, labs, and special-purpose rooms with their capacities and equipment.',
      quickTips: [
        '💡 Use "Import Document" to add multiple rooms quickly',
        'Set room types (classroom, lab, art studio, etc.)',
        'Specify capacity and available equipment'
      ],
      page: 'Rooms',
      icon: Building2,
      completed: rooms.length >= 5,
      count: rooms.length,
      required: 5
    },
    {
      id: 'teaching-groups',
      title: 'Teaching Groups',
      description: 'Create teaching groups for DP students (auto-generated for PYP/MYP)',
      instructions: 'For DP: Group students by subject and level. PYP/MYP teaching groups are created automatically.',
      quickTips: [
        '🚀 Use AI-powered group builder for optimal groupings',
        'DP: Create groups for each subject-level combination',
        'PYP/MYP groups are auto-assigned to class groups'
      ],
      page: 'TeachingGroups',
      icon: Users,
      completed: teachingGroups.length > 0,
      count: teachingGroups.length
    },
    {
      id: 'class-groups',
      title: 'Class Groups',
      description: 'Organize students into batches (PYP/MYP only)',
      instructions: 'Create class groups (batches) for PYP and MYP students who share identical schedules.',
      quickTips: [
        '⚡ Auto-generate class groups by year group',
        'Set batch size (typically 20-25 students)',
        'Not needed for DP (uses teaching groups instead)'
      ],
      page: 'ClassGroups',
      icon: Users,
      completed: classGroups.length > 0 || students.filter(s => s.ib_programme === 'DP').length === students.length,
      count: classGroups.length
    },
    {
      id: 'schedule',
      title: 'Generate Schedule',
      description: 'Create your optimized IB timetable',
      instructions: 'Generate schedules for all programmes. The AI will optimize for conflicts, teacher load, and IB requirements.',
      quickTips: [
        '✨ AI-powered schedule generation',
        'Handles PYP, MYP, and DP programmes',
        'View by student, teacher, or master schedule'
      ],
      page: 'Schedule',
      icon: Calendar,
      completed: false,
      enabled: schools.length > 0 && subjects.length >= 6 && teachers.length >= 3 && students.length >= 5 && rooms.length >= 5
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
      <motion.div 
        className="text-center space-y-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <motion.h1 
            className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent mb-3"
            animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            Welcome to Schedual
          </motion.h1>
          <p className="text-lg text-slate-600 font-medium">
            Let's set up your school step by step
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto">
          <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 rounded-full shadow-lg"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <motion.div
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-full font-bold shadow-lg"
            whileHover={{ scale: 1.1 }}
          >
            {completedSteps} / {steps.length}
          </motion.div>
        </div>
      </motion.div>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isEnabled = index === 0 || steps[index - 1].completed;
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
              whileHover={isEnabled ? { 
                scale: 1.02,
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                transition: { duration: 0.2 }
              } : {}}
            >
              <Card 
                className={`border-2 transition-all duration-300 ${
                  step.completed 
                    ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 shadow-xl' 
                    : isEnabled 
                      ? 'border-indigo-300 hover:border-indigo-500 shadow-lg hover:shadow-2xl bg-gradient-to-br from-white to-indigo-50/30' 
                      : 'border-slate-200 opacity-60 grayscale'
                }`}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <motion.div 
                          className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                            step.completed 
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                              : isEnabled 
                                ? 'bg-gradient-to-br from-indigo-500 to-violet-600' 
                                : 'bg-slate-300'
                          }`}
                          whileHover={isEnabled ? { 
                            scale: 1.2, 
                            rotate: 360,
                            transition: { duration: 0.6 }
                          } : {}}
                          animate={step.completed ? {
                            scale: [1, 1.1, 1],
                            transition: { duration: 2, repeat: Infinity }
                          } : {}}
                        >
                          {step.completed ? (
                            <CheckCircle className="w-7 h-7 text-white" />
                          ) : (
                            <Icon className="w-7 h-7 text-white" />
                          )}
                        </motion.div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-slate-900">
                              {index + 1}. {step.title}
                            </h3>
                            {step.completed && (
                              <Badge className="bg-emerald-500 text-white border-0">
                                ✓ Complete
                              </Badge>
                            )}
                            {!step.completed && step.count !== undefined && step.required && (
                              <Badge variant="outline" className="text-slate-600 font-semibold">
                                {step.count} / {step.required}
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-600 font-medium mb-3">{step.description}</p>
                          
                          {/* Instructions */}
                          <motion.div 
                            className="bg-white/80 rounded-lg p-4 mb-3 border-2 border-indigo-100 shadow-sm"
                            whileHover={{ 
                              scale: 1.02,
                              borderColor: "rgb(165, 180, 252)",
                              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.1)"
                            }}
                          >
                            <p className="text-sm text-slate-700 leading-relaxed">{step.instructions}</p>
                          </motion.div>

                          {/* Quick Tips */}
                          {step.quickTips && (
                            <motion.div 
                              className="space-y-2 bg-amber-50/50 rounded-lg p-3 border border-amber-200"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              transition={{ delay: 0.3 }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <motion.div
                                  animate={{ rotate: [0, 15, -15, 0] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <Zap className="w-4 h-4 text-amber-600" />
                                </motion.div>
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Quick Tips</span>
                              </div>
                              {step.quickTips.map((tip, tipIndex) => (
                                <motion.div 
                                  key={tipIndex} 
                                  className="flex items-start gap-3 p-2 rounded hover:bg-amber-100/50 transition-colors"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.4 + tipIndex * 0.1 }}
                                  whileHover={{ x: 5 }}
                                >
                                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 mt-1.5 flex-shrink-0" />
                                  <p className="text-sm text-slate-700 font-medium">{tip}</p>
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {isEnabled && (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Link to={createPageUrl(step.page)}>
                            <Button 
                              size="lg"
                              className={`shadow-md ${
                                step.completed 
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' 
                                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700'
                              }`}
                            >
                              {step.completed ? 'Review' : 'Start'}
                              <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                          </Link>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {completedSteps === steps.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 shadow-2xl">
            <CardContent className="p-10 text-center">
              <motion.div 
                className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-3xl font-bold text-slate-900 mb-3">
                All Set! 🎉
              </h3>
              <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
                Your school is fully configured and ready to generate optimized schedules
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to={createPageUrl('Dashboard')}>
                  <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg text-lg px-8">
                    Go to Dashboard
                    <ArrowRight className="w-6 h-6 ml-2" />
                  </Button>
                </Link>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}