export function isSupportedCourseVideoUrl(value: unknown): boolean;
export function validateCoursePublishReadiness(lessons: unknown[]): string | null;
export function positionCurriculum<T, L>(sections: Array<T & { lessons: L[] }>): Array<T & { position: number; lessons: Array<L & { position: number }> }>;
export function ownsLessonResource(resource: unknown, scope: { creatorId: string; lessonId: string }): boolean;
export function canAccessLessonResource(input: Record<string, any>): boolean;
