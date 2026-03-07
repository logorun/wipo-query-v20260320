#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TaskValidator {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.tasksFile = path.join(projectDir, '.openclaw', 'tasks.json');
    this.results = [];
  }

  loadTasks() {
    const content = fs.readFileSync(this.tasksFile, 'utf8');
    return JSON.parse(content);
  }

  checkFileExists(filePath) {
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.projectDir, filePath);
    return fs.existsSync(fullPath);
  }

  checkGitChanges() {
    try {
      const status = execSync('git status --short', { 
        cwd: this.projectDir, 
        encoding: 'utf8' 
      });
      return status.trim().length > 0;
    } catch (e) {
      return false;
    }
  }

  checkGitDiff(commitHash) {
    try {
      const diff = execSync(`git diff ${commitHash}^..${commitHash} --stat`, { 
        cwd: this.projectDir, 
        encoding: 'utf8' 
      });
      return diff;
    } catch (e) {
      return '';
    }
  }

  getLastCommit() {
    try {
      const log = execSync('git log -1 --format="%H|%s"', { 
        cwd: this.projectDir, 
        encoding: 'utf8' 
      }).trim();
      const [hash, message] = log.split('|');
      return { hash, message };
    } catch (e) {
      return null;
    }
  }

  verifyTask(task) {
    const result = {
      taskId: task.id,
      description: task.description,
      status: task.status,
      passed: true,
      issues: []
    };

    if (task.status === 'completed') {
      if (task.files && task.files.length > 0) {
        for (const file of task.files) {
          if (!this.checkFileExists(file)) {
            result.passed = false;
            result.issues.push(`文件不存在: ${file}`);
          }
        }
      }

      const hasChanges = this.checkGitChanges();
      if (!hasChanges && task.type !== 'docs') {
        result.passed = false;
        result.issues.push('无代码变更 (git status 为空)');
      }

      if (hasChanges) {
        const lastCommit = this.getLastCommit();
        if (!lastCommit) {
          result.passed = false;
          result.issues.push('无法获取 git commit');
        } else {
          result.lastCommit = lastCommit;
        }
      }

      if (!task.completed_at) {
        result.passed = false;
        result.issues.push('缺少完成时间 (completed_at)');
      }
    }

    if (task.status === 'in_progress') {
      if (!task.started_at) {
        result.issues.push('任务标记进行中但无开始时间');
      }
    }

    if (task.dependencies && task.dependencies.length > 0) {
      const tasks = this.loadTasks().tasks;
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (!depTask || depTask.status !== 'completed') {
          result.passed = false;
          result.issues.push(`依赖未满足: ${depId} (状态: ${depTask?.status || '不存在'})`);
        }
      }
    }

    return result;
  }

  verifyAll() {
    const data = this.loadTasks();
    this.results = data.tasks.map(task => this.verifyTask(task));
    return this.results;
  }

  generateReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;

    let report = `# 任务验证报告\n\n`;
    report += `**项目**: ${this.projectDir}\n`;
    report += `**时间**: ${new Date().toISOString()}\n`;
    report += `**总计**: ${total} 任务 | ✅ 通过: ${passed} | ❌ 失败: ${failed}\n\n`;
    report += `---\n\n`;

    for (const result of this.results) {
      report += `## ${result.taskId}: ${result.description}\n`;
      report += `- 状态: ${result.status}\n`;
      report += `- 验证: ${result.passed ? '✅ 通过' : '❌ 失败'}\n`;
      
      if (result.issues.length > 0) {
        report += `- 问题:\n`;
        for (const issue of result.issues) {
          report += `  - ${issue}\n`;
        }
      }

      if (result.lastCommit) {
        report += `- 最后提交: ${result.lastCommit.hash.substring(0, 7)} - ${result.lastCommit.message}\n`;
      }
      
      report += '\n';
    }

    return report;
  }
}

const projectDir = process.argv[2] || process.cwd();
const validator = new TaskValidator(projectDir);

console.log('🔍 验证任务...');
validator.verifyAll();
console.log(validator.generateReport());

const failedCount = validator.results.filter(r => !r.passed).length;
process.exit(failedCount > 0 ? 1 : 0);
