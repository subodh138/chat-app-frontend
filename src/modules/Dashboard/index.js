import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Input from "../../components/Input";
import User from '../../assets/user.jpeg';
import MyLogo from '../../assets/account.jpeg';
import { io } from 'socket.io-client';

const Dashboard = () => { 
    const [user] = useState(() => JSON.parse(localStorage.getItem('user:detail'))); 
    const [conversations, setConversations] = useState([]); 
    const [users, setUsers] = useState([]); 
    const [socket, setSocket] = useState(null);
    const [textMessage, setTextMessage] = useState('');
    const [messages, setMessages] = useState([]); 

    const messageEndRef = useRef(null);

    // Track active chat safely using localStorage initialization
    const [activeChat, setActiveChat] = useState(() => {
        return JSON.parse(localStorage.getItem('user:activeChat')) || null;
    });

    const userId = user?._id || user?.id || user?.user?._id || user?.user?.id;

    // Ref wrapper to handle stable references inside the interval/socket scopes
    const activeChatRef = useRef(activeChat);
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    // Connect to the backend socket system on startup
    useEffect(() => {
        const socketInstance = io('http://localhost:8000'); 
        setSocket(socketInstance);
        
        return () => socketInstance.disconnect();
    }, []);

    // Memoize to prevent shifting dynamic reference mutations inside useEffect dependencies
    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`http://localhost:8000/api/conversations/${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const resData = await res.json();
            if (Array.isArray(resData)) {
                setConversations(resData);
            }
        } catch (error) {
            console.error("Error fetching conversations:", error);
        }
    }, [userId]);

    // Handle incoming real-time socket streams
    useEffect(() => {
        if (!socket || !userId) return;

        socket.emit('addUser', userId);
        
        socket.on('getUsers', activeUsers => {
            console.log('Online Users System Listing:', activeUsers);
        });

        socket.on('getMessage', data => {
            const currentSelectedPartnerId = activeChatRef.current?.id || activeChatRef.current?._id || activeChatRef.current?.userId;
            
            if (data.senderId === currentSelectedPartnerId || data.senderId === userId) {
                setMessages(prev => [...prev, {
                    user: data.user,
                    message: data.message
                }]);
            }
            fetchConversations();
        });

        return () => {
            socket.off('getUsers');
            socket.off('getMessage');
        };
    }, [socket, userId, fetchConversations]);

    // Auto-scroll chat history viewport element smoothly
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Standardized function to set chat details
    const handleSelectChat = (formattedUser) => {
        setActiveChat(formattedUser);
        localStorage.setItem('user:activeChat', JSON.stringify(formattedUser));
    };

    // Fetch Message Logs
    const fetchMessages = useCallback(async (currentActiveChat) => {
        if (!currentActiveChat || !userId) return;
        const receiverId = currentActiveChat?.id || currentActiveChat?._id || currentActiveChat?.userId;
        if (!receiverId) return;

        try {
            const res = await fetch(`http://localhost:8000/api/message?senderId=${userId}&receiverId=${receiverId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const resData = await res.json();
            
            if (Array.isArray(resData)) {
                setMessages(resData);
            }
        } catch (error) {
            console.error("Error fetching message logs:", error);
        }
    }, [userId]);

    // Fetch All Registered Users for "People" Panel
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/users`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                const resData = await res.json();
                
                const filteredUsers = resData.filter(u => {
                    const checkId = u.userId || u.id || u._id || u.user?.id || u.user?._id;
                    return checkId !== userId;
                });
                setUsers(filteredUsers);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };

        if (userId) {
            fetchAllUsers();
            fetchConversations();
        }
    }, [userId, fetchConversations]);

    // Triggers message loading immediately when active chat transitions
    useEffect(() => {
        if (activeChat) {
            fetchMessages(activeChat);
        }
    }, [activeChat, fetchMessages]);

    // Polling fallback configuration loop
    useEffect(() => {
        const interval = setInterval(() => {
            if (userId) fetchConversations();
        }, 5000); 

        return () => clearInterval(interval);
    }, [userId, fetchConversations]);

    // Decoupled conversion deduplication using useMemo to preserve interface fluidity
    const uniqueConversations = useMemo(() => {
        const list = [];
        const seenIds = new Set();

        conversations.forEach((conv) => {
            const partnerId = conv?.user?.id || conv?.user?._id;
            if (partnerId && !seenIds.has(partnerId)) {
                seenIds.add(partnerId);
                list.push(conv);
            }
        });
        return list;
    }, [conversations]);

    // Send Message Handler
    const handleSend = async (e) => {
        if (e) e.preventDefault(); 
        if (!textMessage.trim() || !activeChat) return;

        const receiverId = activeChat?.id || activeChat?._id || activeChat?.userId;
        const typedPayload = textMessage;

        setTextMessage('');

        // Immediate real-time data transmission pass
        socket?.emit('sendMessage', {
            senderId: userId,
            receiverId: receiverId,
            message: typedPayload
        });

        // Background DB verification state persistence call
        try {
            await fetch(`http://localhost:8000/api/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: userId,
                    message: typedPayload,
                    receiverId: receiverId
                })
            });
            fetchConversations();
        } catch (error) {
            console.error("Error sending message payload:", error);
        }
    };

    return ( 
        <div className='w-screen flex'> 
            {/* LEFT SIDEBAR PANEL: CONVERSATIONS */}
            <div className='w-[25%] h-screen bg-secondary flex flex-col'> 
                <div className='flex items-center my-8 mx-14'> 
                    <div><img src={MyLogo} alt="My Profile Avatar" width={75} height={75} className='border border-primary p-[0px] rounded-full'/></div> 
                    <div className='ml-8'> 
                        <h3 className='text-2xl'>{user?.fullName || 'Admin'}</h3> 
                        <p className='text-lg font-light'>My Account</p> 
                    </div> 
                </div> 
                <hr/> 
                <div className='mx-14 mt-10 overflow-y-auto flex-1'> 
                    <div className='text-primary text-lg font-semibold mb-4'>Messages</div> 
                    <div> 
                        { 
                            uniqueConversations.length > 0 ? (
                                uniqueConversations.map(({ conversationId, user: chatPartner }) => { 
                                    const partnerId = chatPartner?.id || chatPartner?._id;
                                    const currentActiveId = activeChat?.id || activeChat?._id || activeChat?.userId;

                                    return ( 
                                        <div 
                                            key={conversationId}
                                            onClick={() => handleSelectChat({ ...chatPartner, id: partnerId })}
                                            className={`flex items-center py-8 border-b border-b-gray-300 cursor-pointer p-2 rounded-xl transition-all ${currentActiveId === partnerId ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                        > 
                                            <div className='cursor-pointer flex items-center'> 
                                                <div><img src={User} alt="User avatar" width={60} height={60} className="border border-primary p-[2px] rounded-full"/></div> 
                                                <div className='ml-6'> 
                                                    <h3 className='text-lg font-semibold'>{chatPartner?.fullName}</h3> 
                                                    <p className='text-sm font-light text-gray-600'>{chatPartner?.email}</p> 
                                                </div> 
                                            </div> 
                                        </div> 
                                    ) 
                                })
                            ) : (
                                <div className='text-center text-lg font-semibold mt-24 text-gray-500'>No Conversations</div>
                            )
                        } 
                    </div> 
                </div> 
            </div>

            {/* MAIN CONVERSATION WINDOW */}
            <div className='w-[50%] h-screen bg-white flex flex-col items-center'> 
                <div className='w-[75%] bg-secondary h-[80px] my-14 rounded-full flex items-center px-14 py-2'> 
                    <div className='cursor-pointer'>
                    <img 
                        src={User} 
                        alt="Active Chat Avatar" 
                        className="w-[60px] h-[60px] rounded-full object-cover border border-primary p-[2px]" 
                        />
                    </div>
                    <div className='ml-4 mr-auto'> 
                        <h3 className='text-lg'>{activeChat?.fullName || 'Select a user'}</h3> 
                        <p className='text-sm font-light text-gray-600'>{activeChat ? 'Online' : 'Offline'}</p> 
                    </div> 
                </div> 

                <div className='h-[75%] w-full overflow-y-auto shadow-sm'> 
                    <div className='p-14'>
                        {
                            messages.length > 0 ? (
                                messages.map((msg, index) => {
                                    const msgSenderId = msg?.user?.id || msg?.user?._id || msg?.senderId;
                                    const textContent = msg?.message || msg?.msg;
                                    const isMe = msgSenderId === userId;

                                    return (
                                        <div key={index} className={`max-w-[40%] rounded-b-xl p-4 mb-6 ${isMe ? 'bg-primary text-white rounded-tl-xl ml-auto' : 'bg-secondary rounded-tr-xl'}`}>
                                            {textContent}
                                        </div>
                                    )
                                })
                            ) : (
                                <div className='text-center text-lg font-semibold mt-24 text-gray-400'>
                                    {activeChat ? 'No messages yet. Say hello!' : 'Select a user to start chatting.'}
                                </div>
                            )
                        }
                        <div ref={messageEndRef} />
                    </div>
                </div>

                {/* INPUT FOOTER CONTROL STRIP */}
                <form onSubmit={handleSend} className='p-14 w-full flex items-center '> 
                    <Input 
                        placeholder='type a message...' 
                        value={textMessage}
                        onChange={(e) => setTextMessage(e.target.value)} 
                        className='w-[75%]' 
                        inputClassName='p-4 border-0 shadow-md rounded-full bg-light focus:ring-0 focus:border-0 outline-none' 
                        disabled={!activeChat}
                    /> 
                    
                    <button 
                        type="submit"
                        disabled={!textMessage.trim()}
                        className={`ml-4 p-4 cursor-pointer bg-light rounded-full border-0 ${!textMessage.trim() && 'opacity-50 pointer-events-none'}`} 
                    > 
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> 
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" /> 
                            <path d="M10 14l11 -11" /> 
                            <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /> 
                        </svg> 
                    </button> 
                </form> 
            </div> 

            {/* RIGHT SIDEBAR: PEOPLE PANEL */}
            <div className='w-[25%] h-screen bg-light px-8 py-16 overflow-y-auto'> 
                <div className='text-primary text-lg font-semibold mb-4'>People</div>
                <div>
                    {
                        users.length > 0 ? (
                            users.map((item) => {
                                const platformUser = item.user ? item.user : item;
                                const id = item.userId || platformUser?.id || platformUser?._id;

                                return (
                                    <div 
                                        key={id}
                                        onClick={() => handleSelectChat({ ...platformUser, id: id })}
                                        className='flex items-center py-8 border-b border-b-gray-300 cursor-pointer p-2 rounded-xl hover:bg-gray-200 transition-all'
                                    >
                                        <div className='cursor-pointer flex items-center'>
                                            <div><img src={User} alt="User Avatar" width={60} height={60} className="rounded-full border border-primary p-[2px]"/></div>
                                            <div className='ml-6'>
                                                <h3 className='text-lg font-semibold'>{platformUser?.fullName}</h3>
                                                <p className='text-sm font-light text-gray-600'>{platformUser?.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className='text-center text-lg font-semibold mt-24 text-gray-500'>No other users found</div>
                        )
                    }
                </div>
            </div>
        </div> 
    ) 
} 

export default Dashboard;