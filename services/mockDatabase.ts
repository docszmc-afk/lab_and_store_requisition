import { Requisition, Status, Notification } from '../types';
import { MOCK_REQUISITIONS } from '../constants';

// Simulating a database delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MockDatabase {
  private requisitions: Requisition[];
  private notifications: Notification[];

  constructor() {
    // Load from local storage if available, else use constants
    const storedReqs = localStorage.getItem('zankli_requisitions');
    this.requisitions = storedReqs ? JSON.parse(storedReqs) : [...MOCK_REQUISITIONS];

    const storedNotifs = localStorage.getItem('zankli_notifications');
    this.notifications = storedNotifs ? JSON.parse(storedNotifs) : [];
  }

  private persist() {
    localStorage.setItem('zankli_requisitions', JSON.stringify(this.requisitions));
  }

  private persistNotifications() {
    localStorage.setItem('zankli_notifications', JSON.stringify(this.notifications));
  }

  async getRequisitions(): Promise<Requisition[]> {
    await delay(600); // Simulate network latency
    return [...this.requisitions];
  }

  async addRequisition(req: Requisition): Promise<void> {
    await delay(800);
    this.requisitions.unshift(req); // Add to top
    this.persist();
  }

  async updateStatus(id: string, status: Status): Promise<void> {
    await delay(400);
    const index = this.requisitions.findIndex(r => r.id === id);
    if (index !== -1) {
      this.requisitions[index] = { ...this.requisitions[index], status };
      this.persist();
    }
  }

  async getNotifications(userEmail: string): Promise<Notification[]> {
      await delay(200);
      return this.notifications.filter(n => n.recipientEmail === userEmail).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async addNotification(notification: Notification): Promise<void> {
      this.notifications.unshift(notification);
      this.persistNotifications();
  }

  async markNotificationAsRead(id: string): Promise<void> {
      const idx = this.notifications.findIndex(n => n.id === id);
      if (idx !== -1) {
          this.notifications[idx].read = true;
          this.persistNotifications();
      }
  }
  
  getStats() {
      const total = this.requisitions.length;
      const pending = this.requisitions.filter(r => 
        r.status === Status.PENDING_CHAIRMAN_REVIEW || 
        r.status === Status.PENDING_STORE_FULFILLMENT || 
        r.status === Status.PENDING_AUDIT_REVIEW || 
        r.status === Status.PENDING_AUDIT_2_REVIEW || 
        r.status === Status.PENDING_FINAL_APPROVAL
      ).length;
      const approved = this.requisitions.filter(r => r.status === Status.APPROVED).length;
      const cost = this.requisitions.reduce((acc, curr) => acc + curr.totalEstimatedCost, 0);
      
      return { total, pending, approved, cost };
  }
}

export const db = new MockDatabase();