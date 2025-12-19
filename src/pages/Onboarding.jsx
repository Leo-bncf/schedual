import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { CheckCircle, Circle, BookOpen, Users, GraduationCap, Building2, Calendar, ArrowRight } from 'lucide-react';

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

  const steps = [
    {
      id: 'school',
      title: 'School Settings',
      description: 'Configure your school details and schedule parameters',
      page: 'Settings',
      icon: Building2,
      completed: schools.length > 0,
      count: schools.length
    },
    {
      id: 'subjects',
      title: 'Add Subjects',
      description: 'Create IB subjects across all groups (need at least 6)',
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
      page: 'Teachers',
      icon: Users,
      completed: teachers.length >= 3,
      count: teachers.length,
      required: 3
    },
    {
      id: 'students',
      title: 'Add Students',
      description: 'Add students with their DP subject choices (need at least 5)',
      page: 'Students',
      icon: GraduationCap,
      completed: students.length >= 5,
      count: students.length,
      required: 5
    },
    {
      id: 'rooms',
      title: 'Add Rooms',
      description: 'Configure classrooms and labs (need at least 5)',
      page: 'Rooms',
      icon: Building2,
      completed: rooms.length >= 5,
      count: rooms.length,
      required: 5
    },
    {
      id: 'schedule',
      title: 'Create Schedule',
      description: 'Generate your IB timetable',
      page: 'Schedule',
      icon: Calendar,
      completed: false,
      enabled: schools.length > 0 && subjects.length >= 6 && teachers.length >= 3 && students.length >= 5 && rooms.length >= 5
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Welcome to IB Schedule</h1>
        <p className="text-lg text-slate-600">
          Let's set up your school step by step
        </p>
        
        <div className="flex items-center justify-center gap-3">
          <div className="flex-1 max-w-md h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-600">
            {completedSteps} / {steps.length}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isEnabled = index === 0 || steps[index - 1].completed;
          
          return (
            <Card 
              key={step.id}
              className={`border-2 transition-all ${
                step.completed 
                  ? 'border-emerald-200 bg-emerald-50/30' 
                  : isEnabled 
                    ? 'border-indigo-200 hover:border-indigo-300' 
                    : 'border-slate-200 opacity-60'
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      step.completed 
                        ? 'bg-emerald-500' 
                        : isEnabled 
                          ? 'bg-indigo-500' 
                          : 'bg-slate-300'
                    }`}>
                      {step.completed ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : (
                        <Icon className="w-6 h-6 text-white" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {index + 1}. {step.title}
                        </h3>
                        {step.completed && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">
                            Complete
                          </Badge>
                        )}
                        {!step.completed && step.count !== undefined && (
                          <Badge variant="outline" className="text-slate-600">
                            {step.count} / {step.required || '?'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600">{step.description}</p>
                    </div>
                  </div>

                  {isEnabled && (
                    <Link to={createPageUrl(step.page)}>
                      <Button 
                        className={
                          step.completed 
                            ? 'bg-emerald-600 hover:bg-emerald-700' 
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }
                      >
                        {step.completed ? 'Review' : 'Start'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {completedSteps === steps.length && (
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              All Set! 🎉
            </h3>
            <p className="text-slate-600 mb-6">
              Your school is configured and ready for schedule generation
            </p>
            <Link to={createPageUrl('Dashboard')}>
              <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700">
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}